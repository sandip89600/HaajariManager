import axios from "axios";

export const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "haajari-app";

let firebaseAdminApp: any = null;

export async function getFirebaseAdminApp(): Promise<any> {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");

    const existingApps = getApps();
    if (existingApps.length > 0 && existingApps[0]) {
      firebaseAdminApp = existingApps[0];
      return firebaseAdminApp;
    }

    // Option 1: Full JSON string in FIREBASE_SERVICE_ACCOUNT_KEY
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        firebaseAdminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || FIREBASE_PROJECT_ID,
        });
        return firebaseAdminApp;
      } catch (e: any) {
        console.warn("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e.message);
      }
    }

    // Option 2: Individual env variables
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
        firebaseAdminApp = initializeApp({
          credential: cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
          }),
          projectId: FIREBASE_PROJECT_ID,
        });
        return firebaseAdminApp;
      } catch (e: any) {
        console.warn("[Firebase Admin] Failed to initialize with clientEmail/privateKey:", e.message);
      }
    }

    // Option 3: Default initialize with Project ID
    try {
      firebaseAdminApp = initializeApp({
        projectId: FIREBASE_PROJECT_ID,
      });
    } catch (e: any) {
      console.warn("[Firebase Admin] Default app initialization:", e.message);
    }

    return firebaseAdminApp;
  } catch (err: any) {
    console.warn("[Firebase Admin] Module loading deferred or failed:", err.message);
    return null;
  }
}

export interface FirebaseVerificationResult {
  verified: boolean;
  uid?: string;
  phone?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Verifies a Firebase ID token using Firebase Admin SDK (with Google Identity Toolkit fallback).
 * Never logs raw tokens or credentials.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseVerificationResult> {
  if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
    return { verified: false, error: "Firebase idToken is required.", statusCode: 400 };
  }

  const cleanToken = idToken.trim();

  // Primary: Firebase Admin SDK verification
  try {
    const app = await getFirebaseAdminApp();
    if (app) {
      const { getAuth } = await import("firebase-admin/auth");
      const auth = getAuth(app);
      const decoded = await auth.verifyIdToken(cleanToken);
      if (!decoded) {
        return { verified: false, error: "Invalid Firebase ID token.", statusCode: 401 };
      }

      // Check project / audience match
      if (decoded.aud !== FIREBASE_PROJECT_ID && decoded.firebase?.project_id !== FIREBASE_PROJECT_ID) {
        return {
          verified: false,
          error: "Token was not issued for project " + FIREBASE_PROJECT_ID,
          statusCode: 401,
        };
      }

      return {
        verified: true,
        uid: decoded.uid,
        phone: decoded.phone_number,
      };
    }
  } catch (err: any) {
    const errCode = err?.code || "";
    const errMsg = err?.message || "";

    // Known Admin SDK token invalidity codes
    if (
      errCode.includes("auth/id-token-expired") ||
      errCode.includes("auth/argument-error") ||
      errCode.includes("auth/id-token-revoked") ||
      errCode.includes("auth/invalid-id-token") ||
      errMsg.includes("expired") ||
      errMsg.includes("invalid") ||
      errMsg.includes("malformed")
    ) {
      return { verified: false, error: "Invalid or expired Firebase ID token.", statusCode: 401 };
    }

    // If Admin SDK lacks credentials to verify offline certs, fall back to Google Identity Toolkit REST API
    const apiKey = process.env.FIREBASE_API_KEY?.trim();
    if (apiKey) {
      try {
        const res = await axios.post(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
          { idToken: cleanToken },
          { headers: { "Content-Type": "application/json" }, timeout: 10000 }
        );
        const user = res.data?.users?.[0];
        if (user && (user.phoneNumber || user.localId)) {
          return {
            verified: true,
            uid: user.localId,
            phone: user.phoneNumber,
          };
        }
      } catch (restErr: any) {
        return { verified: false, error: "Invalid or expired Firebase ID token.", statusCode: 401 };
      }
    }

    return { verified: false, error: "Firebase token verification failed.", statusCode: 401 };
  }

  // If Admin SDK app is not initialized but FIREBASE_API_KEY is present
  const apiKey = process.env.FIREBASE_API_KEY?.trim();
  if (apiKey) {
    try {
      const res = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        { idToken: cleanToken },
        { headers: { "Content-Type": "application/json" }, timeout: 10000 }
      );
      const user = res.data?.users?.[0];
      if (user && (user.phoneNumber || user.localId)) {
        return {
          verified: true,
          uid: user.localId,
          phone: user.phoneNumber,
        };
      }
    } catch {
      return { verified: false, error: "Invalid or expired Firebase ID token.", statusCode: 401 };
    }
  }

  return { verified: false, error: "Firebase Admin authentication unavailable.", statusCode: 401 };
}
