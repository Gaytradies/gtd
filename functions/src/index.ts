import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Admin SDK once.
admin.initializeApp();

const APP_ID = process.env.APP_ID || "gay-tradies-v2";
const PLATFORM_FEE_PERCENT = 0.15; // 15% platform fee
const MAX_PAYMENT_AMOUNT = 10000; // Maximum £10,000 per transaction

// Get Firebase Functions config at module load time
const config = functions.config();
const STRIPE_SECRET_KEY = config.stripe?.secret_key;
const STRIPE_ELITE_PRICE_ID = config.stripe?.elite_price_id;
const STRIPE_WEBHOOK_SECRET = config.stripe?.webhook_secret;
const DEFAULT_RETURN_URL = config.app?.default_return_url || "https://gaytradies.com";

// Initialize Stripe - will be loaded lazily when needed
let stripe: any = null;
const initStripe = () => {
  if (!stripe) {
    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    // Using dynamic import to avoid loading Stripe at cold start
    const Stripe = require("stripe");
    stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
    });
  }
  return stripe;
};

/**
 * Calculate age from date of birth
 * @param dob Date of birth object with year, month, day
 * @returns Age in years, or null if invalid
 */
const calculateAge = (dob: { year: number; month: number; day: number } | null): number | null => {
  if (!dob || !dob.year || !dob.month || !dob.day) {
    return null;
  }

  const birthDate = new Date(dob.year, dob.month - 1, dob.day);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  return monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
};

/**
 * Validate return URL to prevent open redirects
 * @param url URL to validate
 * @returns true if URL is allowed
 */
const isValidReturnUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const allowedDomains = [
      "gaytradies.com",
      "www.gaytradies.com",
      "localhost",
      "127.0.0.1",
    ];
    
    // Allow any subdomain of gaytradies.com
    const hostname = parsedUrl.hostname;
    const isAllowed = allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
    
    return isAllowed;
  } catch (error) {
    return false;
  }
};

/**
 * Callable Cloud Function to mark a user's email as verified in Firebase Auth
 * and mirror the state into their profile document.
 *
 * Security: requires the caller to have a custom claim `isAdmin === true`.
 * Set this with: admin.auth().setCustomUserClaims(uid, { isAdmin: true })
 */
export const adminMarkEmailVerified = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.isAdmin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin privileges required.");
  }

  const targetUid = data?.uid as string | undefined;
  if (!targetUid) {
    throw new functions.https.HttpsError("invalid-argument", "Missing uid.");
  }

  // Mark the Auth user as email verified
  await admin.auth().updateUser(targetUid, { emailVerified: true });

  // Mirror to profile doc for UI and queries
  const profileRef = admin
    .firestore()
    .collection("artifacts")
    .doc(APP_ID)
    .collection("public")
    .doc("data")
    .collection("profiles")
    .doc(targetUid);

  await profileRef.set(
    {
      emailVerified: true,
      emailVerifiedOverride: true,
      emailValidationStatus: "validated",
      emailValidatedAt: admin.firestore.FieldValue.serverTimestamp(),
      notifications: admin.firestore.FieldValue.arrayUnion({
        type: "email_validated",
        title: "Email verified",
        message: "An admin verified your email so you can continue using all features.",
        timestamp: Date.now(),
        read: false,
        icon: "mail-check",
      }),
    },
    { merge: true }
  );

  return { success: true, uid: targetUid };
});

/**
 * Create a Stripe Checkout Session for Elite Membership subscription
 * Callable from authenticated users
 */
export const createEliteCheckoutSession = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const userId = context.auth.uid;
  const userEmail = data?.email || context.auth.token.email;

  if (!userEmail) {
    throw new functions.https.HttpsError("invalid-argument", "Email is required.");
  }

  try {
    const stripe = initStripe();

    if (!STRIPE_ELITE_PRICE_ID) {
      throw new functions.https.HttpsError("failed-precondition", "Stripe Elite Price ID not configured.");
    }

    // Create or retrieve Stripe customer
    const customersRef = admin
      .firestore()
      .collection("artifacts")
      .doc(APP_ID)
      .collection("public")
      .doc("data")
      .collection("stripe_customers")
      .doc(userId);

    const customerDoc = await customersRef.get();
    let customerId: string;

    if (customerDoc.exists && customerDoc.data()?.customerId) {
      customerId = customerDoc.data()!.customerId;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebaseUID: userId,
          appId: APP_ID,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await customersRef.set({
        customerId: customer.id,
        email: userEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: STRIPE_ELITE_PRICE_ID,
          quantity: 1,
        },
      ],
      customer: customerId,
      client_reference_id: userId,
      success_url: data.successUrl || `${DEFAULT_RETURN_URL}/elite-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: data.cancelUrl || `${DEFAULT_RETURN_URL}/shop`,
      metadata: {
        firebaseUID: userId,
        appId: APP_ID,
      },
      subscription_data: {
        metadata: {
          firebaseUID: userId,
          appId: APP_ID,
        },
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create checkout session");
  }
});

/**
 * Stripe Webhook Handler
 * Handles subscription lifecycle events
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"];

  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    console.error("Missing signature or webhook secret");
    res.status(400).send("Webhook Error: Missing signature or secret");
    return;
  }

  let event: any;

  try {
    const stripe = initStripe();
    event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.firebaseUID || session.client_reference_id;

        if (userId && session.mode === "subscription") {
          // Update user profile with Elite status
          const profileRef = admin
            .firestore()
            .collection("artifacts")
            .doc(APP_ID)
            .collection("public")
            .doc("data")
            .collection("profiles")
            .doc(userId);

          await profileRef.set(
            {
              isElite: true,
              eliteStatus: "active",
              subscriptionId: session.subscription,
              customerId: session.customer,
              eliteActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
              notifications: admin.firestore.FieldValue.arrayUnion({
                type: "elite_activated",
                title: "Elite Membership Activated!",
                message: "Welcome to GayTradies Elite. All premium features are now unlocked.",
                timestamp: Date.now(),
                read: false,
                icon: "star",
              }),
            },
            { merge: true }
          );

          console.log(`Elite subscription activated for user ${userId}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.firebaseUID;

        if (userId) {
          const profileRef = admin
            .firestore()
            .collection("artifacts")
            .doc(APP_ID)
            .collection("public")
            .doc("data")
            .collection("profiles")
            .doc(userId);

          const status = subscription.status; // active, past_due, canceled, etc.
          const isActive = status === "active" || status === "trialing";

          await profileRef.set(
            {
              isElite: isActive,
              eliteStatus: status,
              subscriptionId: subscription.id,
              eliteUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          console.log(`Subscription updated for user ${userId}: ${status}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.firebaseUID;

        if (userId) {
          const profileRef = admin
            .firestore()
            .collection("artifacts")
            .doc(APP_ID)
            .collection("public")
            .doc("data")
            .collection("profiles")
            .doc(userId);

          await profileRef.set(
            {
              isElite: false,
              eliteStatus: "canceled",
              eliteCanceledAt: admin.firestore.FieldValue.serverTimestamp(),
              notifications: admin.firestore.FieldValue.arrayUnion({
                type: "elite_canceled",
                title: "Elite Membership Canceled",
                message: "Your Elite membership has been canceled. Premium features are no longer available.",
                timestamp: Date.now(),
                read: false,
                icon: "info",
              }),
            },
            { merge: true }
          );

          console.log(`Elite subscription canceled for user ${userId}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        // Find user by customer ID
        const customersSnapshot = await admin
          .firestore()
          .collection("artifacts")
          .doc(APP_ID)
          .collection("public")
          .doc("data")
          .collection("stripe_customers")
          .where("customerId", "==", customerId)
          .limit(1)
          .get();

        if (!customersSnapshot.empty) {
          const userId = customersSnapshot.docs[0].id;
          const profileRef = admin
            .firestore()
            .collection("artifacts")
            .doc(APP_ID)
            .collection("public")
            .doc("data")
            .collection("profiles")
            .doc(userId);

          await profileRef.set(
            {
              eliteStatus: "payment_failed",
              notifications: admin.firestore.FieldValue.arrayUnion({
                type: "payment_failed",
                title: "Payment Failed",
                message: "Your Elite membership payment failed. Please update your payment method.",
                timestamp: Date.now(),
                read: false,
                icon: "alert",
              }),
            },
            { merge: true }
          );

          console.log(`Payment failed for user ${userId}`);
        }
        break;
      }

      case "identity.verification_session.verified": {
        const verification = event.data.object;
        const userId = verification.metadata?.firebaseUID;

        if (userId) {
          const profileRef = admin
            .firestore()
            .collection("artifacts")
            .doc(APP_ID)
            .collection("public")
            .doc("data")
            .collection("profiles")
            .doc(userId);

          // Get verified data
          const verifiedData = verification.verified_outputs || {};
          const dob = verifiedData.dob;
          
          // Calculate age if DOB is available
          const age = calculateAge(dob);
          const isOver18 = age !== null ? age >= 18 : false; // Default to false if age cannot be determined

          await profileRef.set(
            {
              ageVerified: true,
              ageVerificationStatus: "verified",
              isOver18,
              ageVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
              verificationId: verification.id,
              notifications: admin.firestore.FieldValue.arrayUnion({
                type: "age_verified",
                title: "Age Verification Complete",
                message: "Your age has been verified successfully.",
                timestamp: Date.now(),
                read: false,
                icon: "shield-check",
              }),
            },
            { merge: true }
          );

          console.log(`Age verification completed for user ${userId}`);
        }
        break;
      }

      case "identity.verification_session.requires_input": {
        const verification = event.data.object;
        const userId = verification.metadata?.firebaseUID;

        if (userId) {
          const profileRef = admin
            .firestore()
            .collection("artifacts")
            .doc(APP_ID)
            .collection("public")
            .doc("data")
            .collection("profiles")
            .doc(userId);

          await profileRef.set(
            {
              ageVerificationStatus: "requires_input",
              notifications: admin.firestore.FieldValue.arrayUnion({
                type: "verification_input_needed",
                title: "Verification Needs Attention",
                message: "Please complete your age verification. Additional information may be needed.",
                timestamp: Date.now(),
                read: false,
                icon: "alert",
              }),
            },
            { merge: true }
          );

          console.log(`Verification requires input for user ${userId}`);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const jobId = paymentIntent.metadata?.jobId;
        const paymentType = paymentIntent.metadata?.type;

        // Only process escrow payments
        if (jobId && paymentType === "escrow") {
          const jobRef = admin
            .firestore()
            .collection("artifacts")
            .doc(APP_ID)
            .collection("public")
            .doc("data")
            .collection("jobs")
            .doc(jobId);

          await jobRef.set(
            {
              paymentStatus: "succeeded",
              paymentIntentId: paymentIntent.id,
              paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
              paymentAmount: paymentIntent.amount / 100, // Convert from cents
            },
            { merge: true }
          );

          console.log(`Escrow payment succeeded for job ${jobId}`);
        }
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object;
        const jobId = paymentIntent.metadata?.jobId;
        const paymentType = paymentIntent.metadata?.type;

        if (jobId && paymentType === "escrow") {
          const jobRef = admin
            .firestore()
            .collection("artifacts")
            .doc(APP_ID)
            .collection("public")
            .doc("data")
            .collection("jobs")
            .doc(jobId);

          await jobRef.set(
            {
              paymentStatus: "canceled",
              paymentCanceledAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          console.log(`Escrow payment canceled for job ${jobId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    res.status(500).send(`Webhook Error: ${error.message}`);
  }
});

/**
 * Create Customer Portal Session for subscription management
 * Callable from authenticated users
 */
export const createCustomerPortalSession = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const userId = context.auth.uid;

  try {
    const stripe = initStripe();

    // Get customer ID from Firestore
    const customerDoc = await admin
      .firestore()
      .collection("artifacts")
      .doc(APP_ID)
      .collection("public")
      .doc("data")
      .collection("stripe_customers")
      .doc(userId)
      .get();

    if (!customerDoc.exists || !customerDoc.data()?.customerId) {
      throw new functions.https.HttpsError("not-found", "No Stripe customer found for this user.");
    }

    const customerId = customerDoc.data()!.customerId;

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: data.returnUrl || `${DEFAULT_RETURN_URL}/settings`,
    });

    return {
      url: session.url,
    };
  } catch (error: any) {
    console.error("Error creating portal session:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create portal session");
  }
});

/**
 * Create Stripe Identity Verification Session for age verification (18+)
 * Callable from authenticated users
 */
export const createIdentityVerificationSession = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const userId = context.auth.uid;
  const returnUrl = data?.returnUrl || `${DEFAULT_RETURN_URL}/verification-complete`;

  // Validate return URL to prevent open redirects
  if (!isValidReturnUrl(returnUrl)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid return URL");
  }

  try {
    const stripe = initStripe();

    // Create verification session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: {
        firebaseUID: userId,
        appId: APP_ID,
      },
      options: {
        document: {
          require_id_number: false,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
      return_url: returnUrl,
    });

    return {
      url: verificationSession.url,
      verificationId: verificationSession.id,
    };
  } catch (error: any) {
    console.error("Error creating identity verification:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create identity verification");
  }
});

/**
 * Create Escrow Payment for job hiring
 * Callable from authenticated users (clients hiring tradies)
 */
export const createEscrowPayment = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const userId = context.auth.uid;
  const {
    jobId,
    amount, // Amount in GBP (e.g., 100.00)
    currency = "gbp",
    tradieAccountId, // Stripe Connect account ID of the tradie
    description,
  } = data;

  // Validate required fields
  if (!jobId || !amount || !tradieAccountId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields: jobId, amount, tradieAccountId"
    );
  }

  if (amount <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Amount must be greater than 0");
  }

  if (amount > MAX_PAYMENT_AMOUNT) {
    throw new functions.https.HttpsError("invalid-argument", `Amount cannot exceed £${MAX_PAYMENT_AMOUNT}`);
  }

  try {
    const stripe = initStripe();

    // Get or create customer
    const customersRef = admin
      .firestore()
      .collection("artifacts")
      .doc(APP_ID)
      .collection("public")
      .doc("data")
      .collection("stripe_customers")
      .doc(userId);

    const customerDoc = await customersRef.get();
    let customerId: string;

    if (customerDoc.exists && customerDoc.data()?.customerId) {
      customerId = customerDoc.data()!.customerId;
    } else {
      // Get user email
      const userProfile = await admin
        .firestore()
        .collection("artifacts")
        .doc(APP_ID)
        .collection("public")
        .doc("data")
        .collection("profiles")
        .doc(userId)
        .get();

      const userEmail = userProfile.data()?.email || context.auth.token.email;

      if (!userEmail) {
        throw new functions.https.HttpsError("invalid-argument", "User email is required");
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebaseUID: userId,
          appId: APP_ID,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await customersRef.set({
        customerId: customer.id,
        email: userEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Calculate application fee (15% platform fee)
    const applicationFeeAmount = Math.round(amount * 100 * PLATFORM_FEE_PERCENT);
    const amountInCents = Math.round(amount * 100);

    // Create Payment Intent with manual capture for escrow
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      customer: customerId,
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: tradieAccountId,
      },
      metadata: {
        jobId,
        firebaseUID: userId,
        appId: APP_ID,
        type: "escrow",
      },
      description: description || `Payment for job ${jobId}`,
      capture_method: "manual", // Hold funds until job is completed
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: any) {
    console.error("Error creating escrow payment:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create escrow payment");
  }
});

/**
 * Capture Escrow Payment when job is completed
 * Callable from authenticated users (tradie or client)
 */
export const captureEscrowPayment = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { paymentIntentId, jobId } = data;

  if (!paymentIntentId || !jobId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing paymentIntentId or jobId");
  }

  try {
    const stripe = initStripe();

    // Verify user is authorized for this job
    const jobDoc = await admin
      .firestore()
      .collection("artifacts")
      .doc(APP_ID)
      .collection("public")
      .doc("data")
      .collection("jobs")
      .doc(jobId)
      .get();

    if (!jobDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Job not found");
    }

    const jobData = jobDoc.data();
    const userId = context.auth.uid;

    // Only client or tradie can capture payment
    if (jobData?.clientUid !== userId && jobData?.tradieUid !== userId) {
      throw new functions.https.HttpsError("permission-denied", "Not authorized to capture this payment");
    }

    // Capture the payment
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    return {
      success: true,
      status: paymentIntent.status,
    };
  } catch (error: any) {
    console.error("Error capturing escrow payment:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to capture payment");
  }
});

/**
 * Cancel Escrow Payment (refund)
 * Callable from authenticated users (admin or authorized party)
 */
export const cancelEscrowPayment = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { paymentIntentId, jobId, reason } = data;

  if (!paymentIntentId || !jobId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing paymentIntentId or jobId");
  }

  try {
    const stripe = initStripe();

    // Verify user is authorized for this job
    const jobDoc = await admin
      .firestore()
      .collection("artifacts")
      .doc(APP_ID)
      .collection("public")
      .doc("data")
      .collection("jobs")
      .doc(jobId)
      .get();

    if (!jobDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Job not found");
    }

    const jobData = jobDoc.data();
    const userId = context.auth.uid;

    // Only client or tradie can cancel payment
    if (jobData?.clientUid !== userId && jobData?.tradieUid !== userId) {
      throw new functions.https.HttpsError("permission-denied", "Not authorized to cancel this payment");
    }

    // Cancel the payment intent (releases funds back to customer)
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId, {
      cancellation_reason: reason || "requested_by_customer",
    });

    return {
      success: true,
      status: paymentIntent.status,
    };
  } catch (error: any) {
    console.error("Error canceling escrow payment:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to cancel payment");
  }
});

