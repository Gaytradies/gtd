# Stripe Integration Setup Guide

This guide explains how to set up Stripe for GayTradies with three main features:
1. **Escrow Payments** - For hiring tradies with secure payments
2. **Subscriptions** - For GayTradies Elite membership (£9.99/month)
3. **Identity Verification** - For 18+ age verification using Stripe Identity

## Prerequisites

1. **Stripe Account**: Sign up at https://stripe.com
2. **Stripe API Keys**: Get your publishable and secret keys from the Stripe Dashboard
3. **Backend API**: You'll need a backend server (Node.js, Firebase Functions, etc.) to handle Stripe operations securely

## Step 1: Stripe Dashboard Setup

### 1.1 Create Products and Prices

1. Go to **Products** in your Stripe Dashboard
2. Create a new product: "GayTradies Elite Membership"
   - Price: £9.99/month (recurring)
   - Billing period: Monthly
   - Copy the **Price ID** (starts with `price_...`)

### 1.2 Enable Stripe Connect

1. Go to **Settings** → **Connect**
2. Enable Connect for your account
3. Set up branding (logo, colors) for the Connect onboarding flow
4. Configure payout settings

### 1.3 Enable Stripe Identity

1. Go to **Settings** → **Identity**
2. Enable Identity verification
3. Configure verification settings for age verification (18+)

### 1.4 Set up Webhooks

1. Go to **Developers** → **Webhooks**
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events to listen for:
   - `checkout.session.completed` - Subscription created
   - `customer.subscription.updated` - Subscription status changed
   - `customer.subscription.deleted` - Subscription cancelled
   - `payment_intent.succeeded` - Escrow payment succeeded
   - `identity.verification_session.verified` - Age verification completed
   - `identity.verification_session.requires_input` - Verification needs attention
4. Copy the **Webhook Signing Secret** (starts with `whsec_...`)

## Step 2: Environment Variables

Add these to your environment (`.env.local` for local development):

```env
# Stripe Keys
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Public key (safe to expose)
STRIPE_SECRET_KEY=sk_test_...  # Secret key (NEVER expose in frontend)
STRIPE_WEBHOOK_SECRET=whsec_...  # Webhook signing secret

# Stripe Product IDs
STRIPE_ELITE_PRICE_ID=price_...  # Price ID for Elite membership

# Application Settings
STRIPE_APPLICATION_FEE_PERCENT=15  # Platform fee (15%)
```

## Step 3: Backend API Implementation

You need to implement these API endpoints (examples use Express.js, but adapt to your stack):

### 3.1 Create Subscription Checkout Session

**Endpoint**: `POST /api/stripe/create-checkout-session`

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { userId, email, priceId, successUrl, cancelUrl } = req.body;
    
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      customer_email: email,
      client_reference_id: userId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
      },
    });
    
    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3.2 Create Escrow Payment

**Endpoint**: `POST /api/stripe/create-escrow-payment`

```javascript
app.post('/api/stripe/create-escrow-payment', async (req, res) => {
  try {
    const { jobId, amount, currency, tradieAccountId, applicationFeeAmount, metadata } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: tradieAccountId,
      },
      metadata: {
        jobId,
        ...metadata,
      },
      capture_method: 'manual', // Escrow: capture later when job completes
    });
    
    res.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3.3 Create Identity Verification Session

**Endpoint**: `POST /api/stripe/create-identity-verification`

```javascript
app.post('/api/stripe/create-identity-verification', async (req, res) => {
  try {
    const { userId, returnUrl } = req.body;
    
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      options: {
        document: {
          require_id_number: false,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
      metadata: {
        userId,
      },
      return_url: returnUrl,
    });
    
    res.json({ 
      url: verificationSession.url,
      verificationId: verificationSession.id 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3.4 Create Connect Account

**Endpoint**: `POST /api/stripe/create-connect-account`

```javascript
app.post('/api/stripe/create-connect-account', async (req, res) => {
  try {
    const { userId, email, type, capabilities } = req.body;
    
    const account = await stripe.accounts.create({
      type,
      email,
      capabilities,
      metadata: {
        userId,
      },
    });
    
    res.json({ 
      accountId: account.id 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3.5 Create Account Link (Onboarding)

**Endpoint**: `POST /api/stripe/create-account-link`

```javascript
app.post('/api/stripe/create-account-link', async (req, res) => {
  try {
    const { accountId, returnUrl, refreshUrl, type } = req.body;
    
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type,
    });
    
    res.json({ url: accountLink.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3.6 Create Customer Portal Session

**Endpoint**: `POST /api/stripe/create-portal-session`

```javascript
app.post('/api/stripe/create-portal-session', async (req, res) => {
  try {
    const { customerId, returnUrl } = req.body;
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    
    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3.7 Get Subscription Status

**Endpoint**: `GET /api/stripe/subscription-status/:customerId`

```javascript
app.get('/api/stripe/subscription-status/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    
    res.json({ 
      hasActiveSubscription: subscriptions.data.length > 0,
      subscription: subscriptions.data[0] || null 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3.8 Webhook Handler

**Endpoint**: `POST /api/stripe/webhook`

```javascript
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      // Update user's subscription status in your database
      await updateUserSubscription(session.client_reference_id, 'active');
      break;
      
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      // Downgrade user from Elite
      await updateUserSubscription(subscription.metadata.userId, 'cancelled');
      break;
      
    case 'identity.verification_session.verified':
      const verification = event.data.object;
      // Mark user as 18+ verified
      await updateUserVerification(verification.metadata.userId, true);
      break;
      
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      // Handle successful escrow payment
      await handleEscrowPayment(paymentIntent);
      break;
  }

  res.json({received: true});
});
```

## Step 4: Frontend Configuration

Add your Stripe publishable key to Firebase config or `.env.local`:

```typescript
// In your Firebase config initialization
const stripeConfig = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  elitePriceId: import.meta.env.VITE_STRIPE_ELITE_PRICE_ID || 'price_...',
};

// Initialize Stripe
import { initializeStripe } from './services/stripeClient';
initializeStripe(stripeConfig.publishableKey);
```

## Step 5: Testing

### Test Mode

Use Stripe test mode keys during development:
- Test cards: https://stripe.com/docs/testing
- Test card number: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

### Test Scenarios

1. **Subscribe to Elite**:
   - Go to Shop tab
   - Click "Subscribe Now" button
   - Complete Stripe Checkout with test card
   - Verify webhook receives `checkout.session.completed`
   - Confirm Elite features are unlocked

2. **Age Verification**:
   - Trigger identity verification flow
   - Use Stripe test documents
   - Verify webhook receives `identity.verification_session.verified`
   - Confirm user is marked as 18+

3. **Escrow Payment**:
   - Create a job request
   - Client pays with test card (funds held in escrow)
   - Complete job
   - Release funds to tradie
   - Verify tradie receives payment minus platform fee

## Step 6: Production Deployment

1. Replace test keys with live keys in production environment
2. Update webhook URL to production domain
3. Enable live mode in Stripe Dashboard
4. Test with real payment methods in small amounts first
5. Monitor Stripe Dashboard for payment activity

## Security Best Practices

1. **Never expose secret keys** in frontend code
2. **Always validate webhooks** using the signing secret
3. **Use HTTPS** for all API endpoints
4. **Implement rate limiting** on payment endpoints
5. **Log all transactions** for audit purposes
6. **Handle errors gracefully** and provide clear user feedback

## Support

- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
- Test Mode: Always test thoroughly before going live

## Key Features Summary

| Feature | Purpose | Stripe Product |
|---------|---------|----------------|
| Escrow Payments | Hold client payment until job complete | Payment Intents + Connect |
| Elite Subscription | Monthly recurring membership | Checkout + Subscriptions |
| Age Verification | Verify users are 18+ | Stripe Identity |
| Tradie Payouts | Direct payments to tradies | Connect + Transfers |
| Customer Portal | Manage subscriptions | Billing Portal |

## Next Steps

1. Implement the backend API endpoints above
2. Set up your Stripe account and get API keys
3. Update the environment variables
4. Test in development mode
5. Deploy to production when ready

---

**Need Help?** Check the Stripe documentation or contact Stripe support for integration assistance.
