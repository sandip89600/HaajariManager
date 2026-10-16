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
  return {
    type: "error",
    error: "Google Sign-In is only supported on mobile devices.",
  };
}
