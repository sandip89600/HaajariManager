/**
 * inAppReview.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Official Google Play Core In-App Review API Integration for Haajari Manager.
 *
 * Underlying library:
 *   `expo-store-review` (v58.0.2)
 *   Android Dependency: `com.google.android.play:review:2.0.1`
 *   Native Class: `ReviewManagerFactory.create(context).requestReviewFlow()`
 *
 * Compliance with Google Play Policies:
 *   1. Never gates reviews (no "Did you like the app? Yes -> Rate, No -> Feedback").
 *   2. Never shows custom popups before Google Play's native review dialog.
 *   3. Respects Google's quota limits (Google controls whether dialog appears).
 *   4. Safe fallback to Google Play Store listing when manually requested from
 *      Settings/Support or when running on devices without Play Services.
 *   5. Never crashes the app: all promises are safely guarded.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Platform, Linking, Alert } from "react-native";
import * as StoreReview from "expo-store-review";
import {
  shouldRequestReview,
  markRequested,
  trackInteraction,
  InteractionType,
} from "./reviewTracker";

export const PLAY_STORE_PACKAGE = "com.haajari.app";
export const PLAY_STORE_MARKET_URI = `market://details?id=${PLAY_STORE_PACKAGE}`;
export const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`;

/**
 * Check if the Google Play In-App Review API is supported on the current device.
 * Returns true only on Android devices with Google Play Store installed & active,
 * or on iOS devices supporting SKStoreReviewController.
 */
export async function isReviewAvailable(): Promise<boolean> {
  try {
    if (Platform.OS === "web") return false;
    return await StoreReview.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Directly opens the Google Play Store app or browser listing.
 * Safe fallback for manual "Rate Us" clicks when the In-App Review API
 * is unavailable or when the quota suppresses the in-app bottom sheet.
 */
export async function openPlayStoreListing(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.open(PLAY_STORE_WEB_URL, "_blank");
      }
      return;
    }

    const canOpenMarket = await Linking.canOpenURL(PLAY_STORE_MARKET_URI).catch(
      () => false,
    );
    if (canOpenMarket) {
      await Linking.openURL(PLAY_STORE_MARKET_URI);
    } else {
      await Linking.openURL(PLAY_STORE_WEB_URL);
    }
  } catch (error) {
    // If all else fails, attempt fallback web link
    try {
      await Linking.openURL(PLAY_STORE_WEB_URL);
    } catch {
      Alert.alert(
        "Google Play Store",
        "Could not open Google Play Store. Please search for 'Haajari' in the Play Store.",
      );
    }
  }
}

export interface RequestReviewOptions {
  /**
   * If true, bypasses session time and cumulative interaction checks.
   * Use this when the user explicitly taps "Rate on Google Play" in Settings or Support.
   */
  force?: boolean;

  /**
   * If true and native in-app review is unavailable, falls back to opening
   * the Google Play Store listing directly.
   * Defaults to false for automated prompts, and true for manual actions.
   */
  fallbackToStore?: boolean;
}

/**
 * Requests the Google Play In-App Review flow.
 *
 * - Automated mode (force = false):
 *   Checks eligibility (minimum session duration, interaction count, quota interval).
 *   If eligible, marks as requested and launches native Google Play Core review dialog.
 *   Note: Google Play quota might silently suppress the dialog — this is expected behavior.
 *
 * - Manual mode (force = true):
 *   Called when the user explicitly clicks "Rate on Google Play" in Settings / Support.
 *   Directly invokes `StoreReview.requestReview()`. If unavailable, opens the Play Store page.
 *
 * Returns true if the review flow was triggered, false otherwise.
 */
export async function requestInAppReview(
  options: RequestReviewOptions = {},
): Promise<boolean> {
  const { force = false, fallbackToStore = force } = options;

  try {
    const available = await isReviewAvailable();

    if (!available) {
      if (fallbackToStore) {
        await openPlayStoreListing();
        return true;
      }
      return false;
    }

    if (!force) {
      const eligible = await shouldRequestReview();
      if (!eligible) {
        return false;
      }
    }

    // Record request timestamp before firing
    await markRequested();

    // Launch Google Play Core Review flow
    await StoreReview.requestReview();
    return true;
  } catch (error) {
    if (fallbackToStore) {
      await openPlayStoreListing();
      return true;
    }
    return false;
  }
}

/**
 * Records a user milestone (attendance marked, worker added, report downloaded)
 * and conditionally triggers an in-app review if all eligibility conditions are met.
 */
export async function recordUserMilestone(
  type: InteractionType,
): Promise<void> {
  try {
    await trackInteraction(type);
  } catch {
    // Silently ignore
  }
}
