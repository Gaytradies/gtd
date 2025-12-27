# Stripe Integration - Complete Feature Set

This document describes all Stripe integrations now available in GayTradies.

## Features Implemented

### 1. Elite Membership Subscriptions ✅
Monthly recurring subscription (£9.99/month) that unlocks premium features.

**Cloud Functions:**
- `createEliteCheckoutSession` - Creates Stripe Checkout session
- `createCustomerPortalSession` - Manages subscription (update payment, cancel, etc.)

**Webhook Events:**
- `checkout.session.completed` - Activates Elite membership
- `customer.subscription.updated` - Updates subscription status
- `customer.subscription.deleted` - Deactivates Elite membership
- `invoice.payment_failed` - Notifies user of payment issues

**User Profile Fields:**
```typescript
{
  isElite: boolean,
  eliteStatus: 'active' | 'trialing' | 'canceled' | 'payment_failed',
  subscriptionId: string,
  customerId: string,
  eliteActivatedAt: Timestamp
}
```

### 2. Age Verification (18+) ✅
Uses Stripe Identity to verify users are 18+ using government-issued ID.

**Cloud Functions:**
- `createIdentityVerificationSession` - Creates verification session with Stripe Identity

**Webhook Events:**
- `identity.verification_session.verified` - Marks user as age-verified
- `identity.verification_session.requires_input` - Notifies user to complete verification

**User Profile Fields:**
```typescript
{
  ageVerified: boolean,
  ageVerificationStatus: 'verified' | 'requires_input' | 'pending',
  isOver18: boolean,
  ageVerifiedAt: Timestamp,
  verificationId: string
}
```

**How to Use:**
```typescript
// From frontend
import { httpsCallable } from 'firebase/functions';
import { functions } from './config/firebase';

const createVerification = httpsCallable(functions, 'createIdentityVerificationSession');
const result = await createVerification({
  returnUrl: `${window.location.origin}/verification-complete`
});

// Redirect user to Stripe Identity
window.location.href = result.data.url;
```

### 3. Escrow Payments for Hiring ✅
Secure payment system for hiring tradies with funds held until job completion.

**Cloud Functions:**
- `createEscrowPayment` - Creates payment intent with manual capture
- `captureEscrowPayment` - Releases funds to tradie when job is complete
- `cancelEscrowPayment` - Refunds customer if job is cancelled

**Webhook Events:**
- `payment_intent.succeeded` - Updates job with payment confirmation
- `payment_intent.canceled` - Updates job with cancellation status

**How to Use:**

#### Step 1: Client Creates Payment
```typescript
const createPayment = httpsCallable(functions, 'createEscrowPayment');
const result = await createPayment({
  jobId: 'job123',
  amount: 100.00, // £100.00
  currency: 'gbp',
  tradieAccountId: 'acct_xxx', // Tradie's Stripe Connect account
  description: 'Plumbing repair job'
});

// Use clientSecret with Stripe Elements to complete payment
const stripe = await loadStripe(publishableKey);
const { error } = await stripe.confirmCardPayment(result.data.clientSecret);
```

#### Step 2: Job Completed - Capture Payment
```typescript
const capturePayment = httpsCallable(functions, 'captureEscrowPayment');
await capturePayment({
  paymentIntentId: 'pi_xxx',
  jobId: 'job123'
});
// Funds are now released to tradie (minus 15% platform fee)
```

#### Step 3: Job Cancelled - Refund Payment
```typescript
const cancelPayment = httpsCallable(functions, 'cancelEscrowPayment');
await cancelPayment({
  paymentIntentId: 'pi_xxx',
  jobId: 'job123',
  reason: 'requested_by_customer'
});
// Funds are refunded to customer
```

**Job Document Fields:**
```typescript
{
  paymentStatus: 'succeeded' | 'canceled' | 'pending',
  paymentIntentId: string,
  paymentCompletedAt: Timestamp,
  paymentAmount: number,
  paymentCanceledAt: Timestamp
}
```

## Platform Fee Structure

### Escrow Payments
- **Platform Fee**: 15% of transaction amount
- **Example**: £100 job → £15 to platform, £85 to tradie
- Automatically handled by Stripe Connect

### Elite Membership
- **Price**: £9.99/month
- **No platform fee** (direct revenue)

## Setup Requirements

### Stripe Dashboard Configuration

1. **Enable Stripe Connect**
   - Go to Settings → Connect
   - Enable Express accounts for tradies
   - Configure branding and payout settings

2. **Enable Stripe Identity**
   - Go to Settings → Identity
   - Enable verification
   - Configure for age verification (18+)

3. **Create Elite Product**
   - Go to Products
   - Create "GayTradies Elite Membership"
   - Price: £9.99/month recurring
   - Copy Price ID

4. **Configure Webhooks**
   - Add endpoint: `https://YOUR-PROJECT.cloudfunctions.net/stripeWebhook`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `identity.verification_session.verified`
     - `identity.verification_session.requires_input`
     - `payment_intent.succeeded`
     - `payment_intent.canceled`

### Environment Variables

**Frontend (.env.local):**
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_STRIPE_ELITE_PRICE_ID=price_...
```

To set up:
```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local with your actual keys
```

**Backend (Firebase Functions config):**
```bash
firebase functions:config:set \
  stripe.secret_key="sk_test_..." \
  stripe.webhook_secret="whsec_..." \
  stripe.elite_price_id="price_..." \
  app.default_return_url="https://your-domain.com"
```

## Security Features

✅ **Secret Keys**: Only in backend Cloud Functions
✅ **Webhook Verification**: All webhooks verified with signature
✅ **Authentication**: All Cloud Functions require user authentication
✅ **Authorization**: Payment operations verify user permissions for jobs
✅ **Manual Capture**: Escrow payments held until job completion
✅ **Automatic Refunds**: Cancelled jobs automatically refund customers

## Testing

### Test Cards (Stripe Test Mode)

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

### Test Age Verification

Stripe provides test documents for Identity verification in test mode.

### Test Escrow Flow

1. Create escrow payment with test card
2. Payment is authorized but not captured
3. Complete job and capture payment
4. Verify tradie receives funds (minus 15% fee)

OR

1. Create escrow payment
2. Cancel job before completion
3. Verify customer receives full refund

## Integration Examples

### Age Verification Button
```typescript
<button onClick={async () => {
  const createVerification = httpsCallable(functions, 'createIdentityVerificationSession');
  const result = await createVerification({
    returnUrl: window.location.href
  });
  window.location.href = result.data.url;
}}>
  Verify Age (18+)
</button>
```

### Escrow Payment in Job Flow
```typescript
// When client accepts quote and ready to pay
const handlePayment = async (job) => {
  const createPayment = httpsCallable(functions, 'createEscrowPayment');
  const result = await createPayment({
    jobId: job.id,
    amount: job.quote.total,
    currency: 'gbp',
    tradieAccountId: job.tradieStripeAccountId,
    description: job.title
  });
  
  // Show Stripe payment UI
  const stripe = await loadStripe(publishableKey);
  const elements = stripe.elements({ clientSecret: result.data.clientSecret });
  // ... configure payment element
};

// When job is marked complete
const handleJobComplete = async (job) => {
  const capturePayment = httpsCallable(functions, 'captureEscrowPayment');
  await capturePayment({
    paymentIntentId: job.paymentIntentId,
    jobId: job.id
  });
  // Payment released to tradie
};
```

## Deployment

1. **Install dependencies:**
   ```bash
   cd functions
   npm install
   ```

2. **Deploy functions:**
   ```bash
   firebase deploy --only functions
   ```

3. **Test webhook:**
   ```bash
   stripe listen --forward-to localhost:5001/PROJECT_ID/us-central1/stripeWebhook
   ```

4. **Update webhook URL** in Stripe Dashboard with deployed function URL

## Support

- **Stripe Dashboard**: Monitor all transactions, subscriptions, and verifications
- **Firebase Console**: Check Cloud Functions logs for errors
- **Webhook Events**: View in Stripe Dashboard → Developers → Webhooks

---

**Status**: All Stripe integrations implemented and ready for testing
**Last Updated**: 2025-12-27
