import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Admin SDK once.
admin.initializeApp();

const APP_ID = process.env.APP_ID || "gay-tradies-v2";

// Initialize Stripe - will be loaded lazily when needed
let stripe: any = null;
const initStripe = () => {
  if (!stripe) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    // Using dynamic import to avoid loading Stripe at cold start
    const Stripe = require("stripe");
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });
  }
  return stripe;
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
    const elitePriceId = process.env.STRIPE_ELITE_PRICE_ID;

    if (!elitePriceId) {
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
          price: elitePriceId,
          quantity: 1,
        },
      ],
      customer: customerId,
      client_reference_id: userId,
      success_url: `${data.successUrl || "https://gaytradies.com/elite-success"}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: data.cancelUrl || "https://gaytradies.com/shop",
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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("Missing signature or webhook secret");
    res.status(400).send("Webhook Error: Missing signature or secret");
    return;
  }

  let event: any;

  try {
    const stripe = initStripe();
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
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
      return_url: data.returnUrl || "https://gaytradies.com/settings",
    });

    return {
      url: session.url,
    };
  } catch (error: any) {
    console.error("Error creating portal session:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create portal session");
  }
});

