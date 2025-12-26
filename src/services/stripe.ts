import { functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';

// Stripe Connect Integration
// This module provides Stripe payment processing and age verification functionality

interface StripeConfig {
  publishableKey: string;
  secretKey?: string; // Should be stored securely on backend
}

// Stripe configuration (will be set from environment or Firebase config)
let stripeConfig: StripeConfig | null = null;
let stripe: any = null;

/**
 * Initialize Stripe with the publishable key
 * This should be called after Firebase is initialized
 */
export const initializeStripe = async (config?: StripeConfig) => {
  if (stripe) return stripe;

  try {
    // Get Stripe key from window config (set by backend)
    const publishableKey = config?.publishableKey || 
                          (typeof window !== 'undefined' && window.__stripe_publishable_key) || 
                          null;

    if (!publishableKey) {
      console.warn('Stripe publishable key not configured');
      return null;
    }

    stripeConfig = {
      publishableKey,
      ...config
    };

    // Dynamically load Stripe.js
    if (typeof window !== 'undefined' && !window.Stripe) {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      document.body.appendChild(script);

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
    }

    // Initialize Stripe
    if (window.Stripe) {
      stripe = window.Stripe(publishableKey);
      console.log('Stripe initialized successfully');
      return stripe;
    }
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }

  return null;
};

/**
 * Get the initialized Stripe instance
 */
export const getStripe = () => stripe;

/**
 * Create a Stripe Connect account for a tradie
 * This initiates the onboarding process
 */
export const createConnectAccount = async (userId: string, email: string) => {
  try {
    if (!functions) throw new Error('Firebase Functions not initialized');
    const createAccount = httpsCallable(functions, 'createStripeConnectAccount');
    const { data }: any = await createAccount({
      userId,
      email,
      type: 'express',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    return data;
  } catch (error) {
    console.error('Failed to create Stripe Connect account:', error);
    throw error;
  }
};

/**
 * Get the onboarding link for a Stripe Connect account
 */
export const getConnectAccountLink = async (accountId: string, returnUrl: string, refreshUrl: string) => {
  try {
    if (!functions) throw new Error('Firebase Functions not initialized');
    const createLink = httpsCallable(functions, 'createStripeAccountLink');
    const { data }: any = await createLink({
      accountId,
      returnUrl,
      refreshUrl,
      type: 'account_onboarding',
    });
    return data.url;
  } catch (error) {
    console.error('Failed to get account link:', error);
    throw error;
  }
};

/**
 * Create a payment intent for a job
 */
export const createPaymentIntent = async (
  amount: number,
  currency: string,
  tradieAccountId: string,
  jobId: string,
  metadata: Record<string, string>
) => {
  try {
    if (!functions) throw new Error('Firebase Functions not initialized');
    const createIntent = httpsCallable(functions, 'createStripePaymentIntent');
    const { data }: any = await createIntent({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      applicationFeeAmount: Math.round(amount * 0.15 * 100),
      transferData: {
        destination: tradieAccountId,
      },
      metadata: {
        jobId,
        ...metadata,
      },
    });
    return data;
  } catch (error) {
    console.error('Failed to create payment intent:', error);
    throw error;
  }
};

/**
 * Create a payout for a tradie
 */
export const createPayout = async (
  accountId: string,
  amount: number,
  currency: string = 'gbp'
) => {
  try {
    if (!functions) throw new Error('Firebase Functions not initialized');
    const createStripePayout = httpsCallable(functions, 'createStripePayout');
    const { data }: any = await createStripePayout({
      accountId,
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
    });
    return data;
  } catch (error) {
    console.error('Failed to create payout:', error);
    throw error;
  }
};

/**
 * Verify age using Stripe Identity
 * This creates a verification session for age verification
 */
export const createIdentityVerification = async (userId: string, email: string) => {
  try {
    if (!functions) throw new Error('Firebase Functions not initialized');
    const createVerification = httpsCallable(functions, 'createStripeIdentityVerification');
    const { data }: any = await createVerification({
      userId,
      email,
      type: 'document',
      options: {
        document: {
          require_id_number: true,
          require_matching_selfie: true,
        },
      },
    });
    return data;
  } catch (error) {
    console.error('Failed to create identity verification:', error);
    throw error;
  }
};

/**
 * Get the status of an identity verification session
 */
export const getIdentityVerificationStatus = async (verificationId: string) => {
  try {
    if (!functions) throw new Error('Firebase Functions not initialized');
    const getStatus = httpsCallable(functions, 'getStripeIdentityVerificationStatus');
    const { data }: any = await getStatus({ verificationId });
    return data;
  } catch (error) {
    console.error('Failed to get verification status:', error);
    throw error;
  }
};

/**
 * Get Stripe Connect account details
 */
export const getConnectAccount = async (accountId: string) => {
  try {
    const response = await fetch(`/api/stripe/account/${accountId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to get account details:', error);
    throw error;
  }
};

/**
 * Initiate GayTradies Elite Subscription
 */
export const createEliteSubscription = async () => {
  try {
    if (!functions) throw new Error('Firebase Functions not initialized');
    const subscribe = httpsCallable(functions, 'createEliteSubscription');
    const { data }: any = await subscribe();
    return data; // Returns { subscriptionId, clientSecret, status }
  } catch (error) {
    console.error('Failed to create Elite subscription:', error);
    throw error;
  }
};

/**
 * Process a payment with the Payment Element
 */
export const confirmPayment = async (_clientSecret: string, paymentElement: any) => {
  if (!stripe) {
    throw new Error('Stripe not initialized');
  }

  try {
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements: paymentElement,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
      },
    });

    if (error) {
      throw error;
    }

    return paymentIntent;
  } catch (error) {
    console.error('Payment confirmation failed:', error);
    throw error;
  }
};

/**
 * Webhook signature verification
 * This should be done on the backend
 */
export const constructWebhookEvent = (_payload: string, _signature: string, _secret: string) => {
  // This is a placeholder - actual implementation should be on backend
  // Stripe webhooks need to be verified using the webhook secret
  console.warn('Webhook verification should be done on backend');
  return null;
};

// Type definitions for window extensions
declare global {
  interface Window {
    __stripe_publishable_key?: string;
    Stripe?: any;
  }
}

export { stripe, stripeConfig };
