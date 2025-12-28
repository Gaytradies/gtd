# Stripe Elite Membership Integration Setup

This guide explains how to set up the Stripe integration for GayTradies Elite Membership.

## Overview

The integration uses:
- **Frontend**: Stripe Checkout for subscription flow
- **Backend**: Firebase Cloud Functions to create checkout sessions and handle webhooks
- **Features**: Proper Stripe integration with Publishable Key, subscription status tracking, and Elite settings unlock

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. Firebase project with Cloud Functions enabled
3. Node.js 18+ installed locally

## Step 1: Stripe Dashboard Setup

### 1.1 Get API Keys

1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Publishable key** (starts with `pk_test_` for test mode)
3. Copy your **Secret key** (starts with `sk_test_` for test mode) - **Keep this secure!**

### 1.2 Create Elite Membership Product

1. Go to https://dashboard.stripe.com/products
2. Click **+ Add product**
3. Fill in:
   - **Name**: `GayTradies Elite Membership`
   - **Description**: `Premium membership with exclusive features`
   - **Pricing model**: `Standard pricing`
   - **Price**: `9.99`
   - **Billing period**: `Recurring - Monthly`
   - **Currency**: `GBP`
4. Click **Save product**
5. Copy the **Price ID** (starts with `price_`) - you'll need this!

### 1.3 Set Up Webhooks

1. Go to https://dashboard.stripe.com/webhooks
2. Click **+ Add endpoint**
3. Set endpoint URL: `https://YOUR-PROJECT-ID.cloudfunctions.net/stripeWebhook`
   - Replace `YOUR-PROJECT-ID` with your Firebase project ID
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`) - you'll need this!

## Step 2: Frontend Environment Configuration

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your keys:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
   VITE_STRIPE_ELITE_PRICE_ID=price_YOUR_PRICE_ID_HERE
   ```

## Step 3: Backend (Firebase Functions) Configuration

1. Install Firebase CLI if you haven't:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Set Firebase Functions environment variables:
   ```bash
   firebase functions:config:set \
     stripe.secret_key="sk_test_YOUR_SECRET_KEY" \
     stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET" \
     stripe.elite_price_id="price_YOUR_PRICE_ID" \
     app.default_return_url="https://your-domain.com"
   ```
   
   Note: For local development, use `http://localhost:5173` as the default return URL.

4. Install dependencies for Cloud Functions:
   ```bash
   cd functions
   npm install
   cd ..
   ```

5. Deploy Cloud Functions:
   ```bash
   firebase deploy --only functions
   ```

## Step 4: Update Webhook URL

After deploying functions:

1. Note the deployed function URL (shows in deploy output)
2. Go back to Stripe Dashboard > Webhooks
3. Edit your webhook endpoint
4. Update URL to: `https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/stripeWebhook`

## Step 5: Test the Integration

### Test in Development Mode

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to the Shop tab (Elite Membership page)

3. Click "Join GayTradies Elite"

4. You should be redirected to Stripe Checkout

5. Use a test card:
   - **Card number**: `4242 4242 4242 4242`
   - **Expiry**: Any future date
   - **CVC**: Any 3 digits
   - **ZIP**: Any 5 digits

6. Complete the checkout

7. Check that:
   - User is redirected to success page
   - User profile is updated with `isElite: true`
   - Elite features are unlocked

### Test Webhook Locally

For local webhook testing, use the Stripe CLI:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli

2. Forward webhooks to local:
   ```bash
   stripe listen --forward-to localhost:5001/YOUR-PROJECT-ID/us-central1/stripeWebhook
   ```

3. Use the webhook signing secret from the CLI output

## Step 6: Elite Settings Implementation

The Elite features that should be unlocked after subscription:

1. **Incognito Mode**: Browse anonymously
2. **Advanced Privacy**: Control profile visibility
3. **Photo Blur Control**: Hide photos until ready to share
4. **Screenshot Detection**: Get notified of screenshots
5. **Elite Badge**: Verified elite member badge on profile

### Checking Elite Status in Code

To check Elite status in components:

```typescript
import { doc, getDoc } from 'firebase/firestore';
import { db, getAppId } from '../config/firebase';

// Check if user has Elite subscription
const checkEliteStatus = async (userId: string) => {
  const profileRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', userId);
  const profileDoc = await getDoc(profileRef);
  const profile = profileDoc.data();
  
  return profile?.isElite === true && 
         (profile?.eliteStatus === 'active' || profile?.eliteStatus === 'trialing');
};
```

### Settings Page Integration

The Settings page now includes:
- **Elite Active Badge**: Shows when user has active subscription
- **Manage Subscription Button**: Opens Stripe Customer Portal
- **Subscribe Button**: Shows for non-Elite users to subscribe
- **Feature Toggles**: All Elite features with proper gating

Elite features are automatically unlocked when `profile.isElite === true`.

## Step 7: Production Deployment

When ready for production:

1. **Switch to Live Keys**:
   - Get live keys from Stripe Dashboard (switch from Test mode to Live mode)
   - Update Firebase Functions config with live keys
   - Update `.env.local` with live publishable key

2. **Deploy**:
   ```bash
   firebase deploy --only functions
   npm run build
   # Deploy frontend to your hosting
   ```

3. **Update Webhook**:
   - Update webhook endpoint URL in Stripe Dashboard to production URL
   - Ensure webhook secret matches

4. **Test with Real Payment**:
   - Use a small amount first to test
   - Verify subscription appears in Stripe Dashboard
   - Confirm Elite features unlock correctly

## Subscription Management

Users can manage their subscription:

1. From Settings page
2. Click "Manage Subscription"
3. Redirects to Stripe Customer Portal
4. Can update payment method, cancel subscription, view invoices

## Troubleshooting

### Checkout Not Working

- Check browser console for errors
- Verify Stripe publishable key is correct
- Ensure Firebase Functions are deployed
- Check Firebase Functions logs: `firebase functions:log`

### Webhook Not Triggering

- Verify webhook URL is correct
- Check webhook signing secret matches
- Test webhook with Stripe CLI
- Check Stripe Dashboard > Webhooks > Event logs

### Elite Status Not Updating

- Check Firebase Functions logs for errors
- Verify webhook events are being received
- Ensure user ID is being passed correctly in metadata
- Check Firestore profile document directly

## Support

For issues:
1. Check Firebase Functions logs: `firebase functions:log`
2. Check Stripe Dashboard event logs
3. Review browser console errors
4. Check Firestore profile document structure

## Security Notes

- **Never expose** Secret Key (`sk_test_` or `sk_live_`) in frontend code
- **Never commit** `.env.local` to version control
- **Always verify** webhook signatures on backend
- **Use HTTPS** for all production endpoints
- **Implement rate limiting** on Cloud Functions if needed

---

**Need Help?** Check the Stripe documentation or contact Stripe support for integration assistance.
