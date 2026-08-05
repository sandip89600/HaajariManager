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
 *   1. Waits REVIEW_DELAY_MS (2.5 minutes) after the hook mounts.
 *   2. When the timer fires, checks ALL eligibility conditions via reviewTracker.
 *   3. If eligible: marks as requested, then calls StoreReview.requestReview().
 *   4. If not eligible or if Google decides not to show it: silently does nothing.
 *
 * Guarantees:
 *   - One-time only (AsyncStorage flag)
 *   - Never crashes the app (all errors caught)
 *   - Silent in Expo Go / dev builds (isAvailableAsync returns false)
 *   - No custom popups, no Play Store redirects
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from "react";
import * as StoreReview from "expo-store-review";
import {
  shouldRequestReview,
  markRequested,
} from "@/utils/reviewTracker";

interface UseInAppReviewOptions {
  /**
   * Set to true when the screen is stable and ready to show a review prompt.
   * Set to false during loading states, modals, or critical workflows.
   */
  isReady: boolean;
}

/** Delay (ms) after mounting before eligibility is evaluated (2.5 minutes) */
const REVIEW_DELAY_MS = 2.5 * 60 * 1000;

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
        // Double-check isReady hasn't changed (component might have unmounted)
        if (hasAttempted.current) return;
        hasAttempted.current = true;

        // Step 1: Check if this platform supports in-app review
        const isAvailable = await StoreReview.isAvailableAsync();
        if (!isAvailable) {
          // Silently skip — Expo Go, simulators, or unsupported devices
          return;
        }

        // Step 2: Evaluate all business conditions
        const eligible = await shouldRequestReview();
        if (!eligible) {
          // Conditions not met (already requested, too short session, etc.)
          return;
        }

        // Step 3: Mark as requested BEFORE calling the API
        // This ensures we never prompt again even if the API throws
        await markRequested();

        // Step 4: Request the native review dialog
        // Google/Apple may or may not show it — that's their decision
        await StoreReview.requestReview();

      } catch (error) {
        // Silently swallow all errors — review must never crash the app
        // In development, you can uncomment the line below for debugging:
        // console.warn("[useInAppReview] Error:", error);
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
