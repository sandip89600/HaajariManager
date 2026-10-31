/**
 * useInAppReview.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that manages the Google Play / StoreKit In-App Review trigger.
 *
 * Usage:
 *   Call `useInAppReview({ isReady: true })` inside DashboardScreen.
 *   Set `isReady` to false during loading, onboarding, or critical workflows.
 *
 * How it works:
 *   1. Waits REVIEW_DELAY_MS (2 minutes) after the hook mounts.
 *   2. When the timer fires, requests review through inAppReview utility.
 *   3. If eligible: marks as requested, then invokes native Google Play Core review dialog.
 *   4. If not eligible or if Google quota suppresses it: silently does nothing.
 *
 * Guarantees:
 *   - Respects Google Play quotas and lifetime caps
 *   - Never crashes the app (all errors caught)
 *   - Silent on unsupported devices and emulators
 *   - Complies fully with Google Play policies
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from "react";
import { requestInAppReview } from "@/utils/inAppReview";

interface UseInAppReviewOptions {
  /**
   * Set to true when the screen is stable and ready to show a review prompt.
   * Set to false during loading states, modals, or critical workflows.
   */
  isReady: boolean;
}

/** Delay (ms) after mounting before eligibility is evaluated (2 minutes) */
const REVIEW_DELAY_MS = 2 * 60 * 1000;

export function useInAppReview({ isReady }: UseInAppReviewOptions): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAttempted = useRef(false);

  useEffect(() => {
    // Don't start timer if the screen isn't ready yet
    if (!isReady) return;

    // Prevent multiple timer setups
    if (hasAttempted.current) return;

    timerRef.current = setTimeout(async () => {
      try {
        if (hasAttempted.current) return;
        hasAttempted.current = true;

        // Trigger automated review flow
        await requestInAppReview({ force: false, fallbackToStore: false });
      } catch (error) {
        // Silently swallow all errors — review must never crash the app
      }
    }, REVIEW_DELAY_MS);

    // Cleanup: cancel timer if component unmounts before it fires
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isReady]);
}
