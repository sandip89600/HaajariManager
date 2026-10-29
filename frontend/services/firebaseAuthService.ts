import axios from "axios";
import { API_URL } from "@/utils/storage";

// Read API key from google-services.json or fallback
let FIREBASE_WEB_API_KEY = "AIzaSyCLNAY2kuYWyKbifID8rqxv39ynqMeahvA";
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const googleServices = require("../google-services.json");
  const extractedKey = googleServices?.client?.[0]?.api_key?.[0]?.current_key;
  if (extractedKey) {
    FIREBASE_WEB_API_KEY = extractedKey;
  }
} catch {
  // Fallback to configured key
}

export function formatE164Phone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (rawPhone.startsWith("+")) {
    return rawPhone.trim();
  }
  return `+${digits}`;
}

export interface FirebaseSendOtpResponse {
  success: boolean;
  sessionInfo?: string;
  error?: string;
  fallbackUsed?: boolean;
}

export interface FirebaseVerifyOtpResponse {
  success: boolean;
  idToken?: string;
  phone?: string;
  uid?: string;
  error?: string;
}

export interface FirebaseBackendLoginResponse {
  success: boolean;
  isNewUser?: boolean;
  token?: string;
  refreshToken?: string;
  user?: any;
  hasInvitedProfile?: boolean;
  error?: string;
}

/**
 * Dispatches Phone OTP using Firebase Identity Toolkit REST API
 * (Fully compatible with Expo Go and Expo Dev Client).
 */
export async function sendFirebasePhoneOtp(phone: string): Promise<FirebaseSendOtpResponse> {
  const e164 = formatE164Phone(phone);

  try {
    const res = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${FIREBASE_WEB_API_KEY}`,
      { phoneNumber: e164 },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    if (res.data?.sessionInfo) {
      return { success: true, sessionInfo: res.data.sessionInfo };
    }
    return { success: false, error: "Firebase did not return session verification info." };
  } catch (err: any) {
    const rawError = err?.response?.data?.error?.message || err?.message || "";
    let errorMsg = rawError || "Failed to dispatch Firebase Phone OTP.";

    if (rawError.includes("BILLING_NOT_ENABLED")) {
      errorMsg =
        "Firebase Phone Auth: SMS dispatch requires Blaze billing enabled on Firebase project 'haajari-app' (first 10,000 SMS/month are free), or test phone numbers added in Firebase Console.";
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Verifies Phone OTP Code with Firebase and returns Firebase ID Token
 */
export async function verifyFirebasePhoneOtp(
  sessionInfo: string,
  code: string
): Promise<FirebaseVerifyOtpResponse> {
  if (!sessionInfo || !code) {
    return { success: false, error: "Session and 6-digit code are required." };
  }

  try {
    const res = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${FIREBASE_WEB_API_KEY}`,
      { sessionInfo, code: code.trim() },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    if (res.data?.idToken) {
      return {
        success: true,
        idToken: res.data.idToken,
        phone: res.data.phoneNumber,
        uid: res.data.localId,
      };
    }

    return { success: false, error: "Firebase failed to return authentication token." };
  } catch (err: any) {
    const errorMsg =
      err?.response?.data?.error?.message || err?.message || "Invalid or expired verification code.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Exchanges verified Firebase ID token for Haajari JWT session on backend
 */
export async function loginWithFirebaseIdToken(
  idToken: string,
  phone: string
): Promise<FirebaseBackendLoginResponse> {
  try {
    const res = await axios.post(
      `${API_URL}/auth/firebase-phone-login`,
      { idToken, phone },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    if (res.data?.isNewUser) {
      return {
        success: true,
        isNewUser: true,
        user: { phone: res.data.phone },
        hasInvitedProfile: res.data.hasInvitedProfile,
      };
    }

    if (res.data?.success && res.data?.token) {
      return {
        success: true,
        isNewUser: false,
        token: res.data.token,
        refreshToken: res.data.refreshToken,
        user: res.data.user,
      };
    }

    return { success: false, error: res.data?.message || "Failed to log in with Firebase." };
  } catch (err: any) {
    const errorMsg =
      err?.response?.data?.message || err?.response?.data?.error || err?.message || "Firebase login error.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Claims an invited worker profile with Firebase ID token
 */
export async function claimWorkerProfileWithFirebase(
  idToken: string,
  phone: string,
  workerId?: string
): Promise<{ success: boolean; worker?: any; error?: string }> {
  try {
    const res = await axios.post(
      `${API_URL}/auth/claim-worker-profile`,
      { idToken, phone, workerId },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    if (res.data?.success) {
      return { success: true, worker: res.data.worker };
    }
    return { success: false, error: res.data?.message || "Failed to claim worker profile." };
  } catch (err: any) {
    return {
      success: false,
      error: err?.response?.data?.message || err?.message || "Failed to claim worker profile.",
    };
  }
}
