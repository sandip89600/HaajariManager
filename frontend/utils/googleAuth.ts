import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Google OAuth 2.0 Web Client ID configuration (Server Audience)
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  "734339237204-ck40vfaneag57k5u541g1vsr1v18uule.apps.googleusercontent.com";

let isGoogleConfigured = false;

function configureGoogleSignin() {
  if (isGoogleConfigured) return;
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
      scopes: ["profile", "email"],
    });
    isGoogleConfigured = true;
  } catch (err) {
    console.warn("[GoogleSignin] Configuration error:", err);
  }
}

export interface GoogleAuthResult {
  type: "success" | "cancel" | "error";
  idToken?: string;
  accessToken?: string;
  user?: {
    email?: string;
    name?: string;
    picture?: string;
    sub?: string;
  };
  error?: string;
}

export async function promptGoogleSignIn(): Promise<GoogleAuthResult> {
  // Check if running inside standard Expo Go (where custom native C++/Java modules cannot run)
  if (Constants.appOwnership === "expo") {
    return {
      type: "error",
      error: "Native Google Sign-In requires an Expo Development Build (EAS Build). Please build and install the Haajari Development Build APK.",
    };
  }

  try {
    configureGoogleSignin();

    // Ensure Google Play Services are available on Android devices
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const signInResult = await GoogleSignin.signIn();

    // Extract ID token and profile data from Native Google Sign-In response
    let idToken = signInResult.data?.idToken || (signInResult as any).idToken;
    let user = signInResult.data?.user || (signInResult as any).user;

    if (!idToken) {
      const tokens = await GoogleSignin.getTokens().catch(() => null);
      if (tokens?.idToken) {
        idToken = tokens.idToken;
      }
    }

    if (idToken) {
      return {
        type: "success",
        idToken,
        accessToken: (signInResult as any)?.data?.accessToken || (signInResult as any)?.accessToken,
        user: user
          ? {
              email: user.email,
              name: user.name,
              picture: user.photo,
              sub: user.id,
            }
          : undefined,
      };
    }

    return { type: "cancel" };
  } catch (err: any) {
    const errMessage = String(err?.message || err);
    if (err.code === statusCodes.SIGN_IN_CANCELLED) {
      return { type: "cancel" };
    } else if (err.code === statusCodes.IN_PROGRESS) {
      return { type: "cancel" };
    } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { type: "error", error: "Google Play Services is not available on this device." };
    } else if (errMessage.includes("RNGoogleSignin") || errMessage.includes("could not be found") || errMessage.includes("TurboModuleRegistry")) {
      return {
        type: "error",
        error: "RNGoogleSignin native module is missing from the installed APK. Please build and install a new EAS Development Build.",
      };
    } else {
      console.warn("[Google Sign-In Exception]:", errMessage);
      return { type: "error", error: errMessage || "Google Sign-In failed. Please try again." };
    }
  }
}
