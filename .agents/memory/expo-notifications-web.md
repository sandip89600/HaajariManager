---
name: expo-notifications web compatibility
description: How to handle expo-notifications web bundling failures in Expo projects
---

# Expo Notifications Web Compatibility

## The Rule
Create a `.web.ts` platform stub alongside `notifications.ts` so Metro uses the stub for web bundling instead of the native implementation.

**Why:** `expo-notifications` imports platform-specific files (like `./topicSubscription`) that don't exist in the web build, causing Metro to fail with "Unable to resolve module" errors at bundle time — not at runtime, so try-catch can't help.

**How to apply:**
- `utils/notifications.ts` → full native implementation (imported on iOS/Android)
- `utils/notifications.web.ts` → stub that exports the same interface but all functions return `false`/`null`/`void`
- Metro's platform resolution: `.web.ts` wins over `.ts` on web, so the import statement `from "@/utils/notifications"` automatically resolves to the right file per platform.

## Additional Notes
- Push notifications are NOT supported in Expo Go from SDK 53+. Local scheduled notifications still work.
- Always guard native-only code with `if (Platform.OS === "web") return;`
