import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Admin SDK once.
admin.initializeApp();

const APP_ID = process.env.APP_ID || "gay-tradies-v2";

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

