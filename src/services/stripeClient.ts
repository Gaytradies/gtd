// Stripe Client Integration using @stripe/stripe-js
// This module provides Stripe payment processing, subscriptions, and age verification functionality

import { loadStripe, Stripe } from '@stripe/stripe-js';

// Stripe instance
let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Initialize Stripe with the publishable key
 * Call this once in your app initialization
 */
export const initializeStripe = (publishableKey: string): Promise<Stripe | null> => {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

/**
 * Get the initialized Stripe instance
 */
export const getStripe = async (): Promise<Stripe | null> => {
  if (!stripePromise) {
    console.warn('Stripe not initialized. Call initializeStripe first.');
    return null;
  }
  return stripePromise;
};

/**
 * Create a subscription checkout session for GayTradies Elite
 */
export const createSubscriptionCheckout = async (userId: string, email: string, priceId: string) => {
  try {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        email,
        priceId, // Stripe Price ID for the subscription
        mode: 'subscription',
        successUrl: `${window.location.origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/shop`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { sessionId } = await response.json();
    
    // Redirect to Stripe Checkout
    const stripe = await getStripe();
    if (stripe) {
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) {
        throw error;
      }
    }
  } catch (error) {
    console.error('Failed to create subscription checkout:', error);
    throw error;
  }
};

/**
 * Create a payment intent for escrow job payments
 */
export const createEscrowPayment = async (
  jobId: string,
  amount: number,
  currency: string,
  tradieAccountId: string,
  clientId: string,
  metadata: Record<string, string>
) => {
  try {
    const response = await fetch('/api/stripe/create-escrow-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobId,
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        tradieAccountId,
        clientId,
        applicationFeeAmount: Math.round(amount * 0.15 * 100), // 15% platform fee
        metadata,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create escrow payment');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to create escrow payment:', error);
    throw error;
  }
};

/**
 * Create an identity verification session for 18+ age verification
 */
export const createIdentityVerification = async (userId: string) => {
  try {
    const response = await fetch('/api/stripe/create-identity-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        returnUrl: `${window.location.origin}/verification-complete`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create identity verification');
    }

    const { url, verificationId } = await response.json();
    return { url, verificationId };
  } catch (error) {
    console.error('Failed to create identity verification:', error);
    throw error;
  }
};

/**
 * Get customer portal session for managing subscriptions
 */
export const createCustomerPortalSession = async (customerId: string) => {
  try {
    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
        returnUrl: `${window.location.origin}/settings`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create portal session');
    }

    const { url } = await response.json();
    return url;
  } catch (error) {
    console.error('Failed to create portal session:', error);
    throw error;
  }
};

/**
 * Create a Stripe Connect account for tradies to receive payments
 */
export const createConnectAccount = async (userId: string, email: string) => {
  try {
    const response = await fetch('/api/stripe/create-connect-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        email,
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create connect account');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to create connect account:', error);
    throw error;
  }
};

/**
 * Get Connect account onboarding link
 */
export const getConnectAccountLink = async (accountId: string) => {
  try {
    const response = await fetch('/api/stripe/create-account-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        returnUrl: `${window.location.origin}/payments`,
        refreshUrl: `${window.location.origin}/payments`,
        type: 'account_onboarding',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get account link');
    }

    const { url } = await response.json();
    return url;
  } catch (error) {
    console.error('Failed to get account link:', error);
    throw error;
  }
};

/**
 * Cancel a subscription
 */
export const cancelSubscription = async (subscriptionId: string) => {
  try {
    const response = await fetch('/api/stripe/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to cancel subscription');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to cancel subscription:', error);
    throw error;
  }
};

/**
 * Get subscription status
 */
export const getSubscriptionStatus = async (customerId: string) => {
  try {
    const response = await fetch(`/api/stripe/subscription-status/${customerId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get subscription status');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to get subscription status:', error);
    throw error;
  }
};

export default {
  initializeStripe,
  getStripe,
  createSubscriptionCheckout,
  createEscrowPayment,
  createIdentityVerification,
  createCustomerPortalSession,
  createConnectAccount,
  getConnectAccountLink,
  cancelSubscription,
  getSubscriptionStatus,
};
