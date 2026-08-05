/**
 * reviewTracker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central utility for Google Play / StoreKit In-App Review tracking.
 *
 * Manages:
 *  - Session start timestamps
 *  - Cumulative meaningful interaction counts
 *  - "Review already requested" flag (never prompt again once fired)
 *
 * All state is persisted in AsyncStorage so it survives app restarts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── AsyncStorage Keys ────────────────────────────────────────────────────────
const KEYS = {
  REVIEW_REQUESTED: "@haajari/review_requested",
  SESSION_START: "@haajari/session_start",
  INTERACTION_COUNT: "@haajari/interaction_count",
  INSTALL_DATE: "@haajari/install_date",
} as const;

// ─── Interaction Types ────────────────────────────────────────────────────────
export type InteractionType =
  | "attendance_marked"
  | "worker_created"
  | "report_viewed"
  | "site_visited"
  | "screen_navigated";

// ─── Thresholds ───────────────────────────────────────────────────────────────
/** Minimum session duration in milliseconds before review is eligible (2.5 min) */
const MIN_SESSION_MS = 2.5 * 60 * 1000;

/** Minimum cumulative interactions required before review is eligible */
const MIN_INTERACTIONS = 3;

// ─── Session Start ────────────────────────────────────────────────────────────

/**
 * Call this when the user successfully signs in or the app becomes active
 * after a fresh auth. Records the current timestamp as session start.
 * Also sets the install date on first launch.
 */
export async function markSessionStart(): Promise<void> {
  try {
    const now = Date.now().toString();
    await AsyncStorage.setItem(KEYS.SESSION_START, now);

    // Record install/first-launch date (only if not already set)
    const existing = await AsyncStorage.getItem(KEYS.INSTALL_DATE);
    if (!existing) {
      await AsyncStorage.setItem(KEYS.INSTALL_DATE, now);
    }
  } catch (e) {
    // Silently ignore — review tracking must never crash the app
  }
}

// ─── Interaction Tracking ─────────────────────────────────────────────────────

/**
 * Increment the cumulative interaction counter.
 * Call this after meaningful user actions (mark attendance, create worker, etc.)
 */
export async function trackInteraction(type: InteractionType): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.INTERACTION_COUNT);
    const current = raw ? parseInt(raw, 10) : 0;
    await AsyncStorage.setItem(
      KEYS.INTERACTION_COUNT,
      (current + 1).toString()
    );
  } catch (e) {
    // Silently ignore
  }
}

// ─── Review State ─────────────────────────────────────────────────────────────

/**
 * Returns true if a review prompt has already been requested on this device.
 * Once true, it will never be reset unless AsyncStorage is cleared manually.
 */
export async function hasBeenRequested(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEYS.REVIEW_REQUESTED);
    return val === "true";
  } catch (e) {
    return true; // Fail-safe: assume requested to avoid accidental repeat prompts
  }
}

/**
 * Mark that the review prompt has been shown. Call this immediately BEFORE
 * invoking StoreReview.requestReview() so that even if the call throws,
 * we won't attempt again.
 */
export async function markRequested(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.REVIEW_REQUESTED, "true");
  } catch (e) {
    // Silently ignore
  }
}

// ─── Core Eligibility Check ───────────────────────────────────────────────────

/**
 * Evaluates ALL conditions required before requesting an in-app review.
 *
 * Conditions:
 *  1. Review has never been requested before
 *  2. Session has been active for at least MIN_SESSION_MS
 *  3. User has completed at least MIN_INTERACTIONS meaningful actions
 *
 * Returns true only when every condition passes.
 */
export async function shouldRequestReview(): Promise<boolean> {
  try {
    // Condition 1 – Never requested before
    const alreadyRequested = await hasBeenRequested();
    if (alreadyRequested) return false;

    // Condition 2 – Session duration
    const sessionStartRaw = await AsyncStorage.getItem(KEYS.SESSION_START);
    if (!sessionStartRaw) return false;
    const sessionStart = parseInt(sessionStartRaw, 10);
    const sessionDuration = Date.now() - sessionStart;
    if (sessionDuration < MIN_SESSION_MS) return false;

    // Condition 3 – Interaction count
    const interactionRaw = await AsyncStorage.getItem(KEYS.INTERACTION_COUNT);
    const interactionCount = interactionRaw ? parseInt(interactionRaw, 10) : 0;
    if (interactionCount < MIN_INTERACTIONS) return false;

    return true;
  } catch (e) {
    return false; // Fail-safe: never crash the app over review logic
  }
}

// ─── Debug / Reset (Development Only) ────────────────────────────────────────

/**
 * Reset all review tracking state. Use in development/testing only.
 * Never call this in production code paths.
 */
export async function resetReviewState(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      KEYS.REVIEW_REQUESTED,
      KEYS.SESSION_START,
      KEYS.INTERACTION_COUNT,
      KEYS.INSTALL_DATE,
    ]);
  } catch (e) {
    // Silently ignore
  }
}
