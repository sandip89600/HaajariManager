---
name: Expo SDK 54 package versions
description: Required npm version ranges for expo packages compatible with SDK 54
---

# Expo SDK 54 Package Versions

## The Rule
When installing expo packages that aren't pre-installed, always specify the version range that matches the SDK version. Running `npx expo install` or checking `expo doctor` output reveals the expected versions.

**Why:** npm installs the latest version by default (e.g., 56.x) which is built for a newer SDK and breaks with "createPermissionHook is not a function" or similar API mismatch errors.

## SDK 54 Version Mapping (key packages)
- `expo-location` → `~19.0.8`
- `expo-notifications` → `~0.32.17`

**How to apply:** Always pin with `~` range: `npm install expo-location@~19.0.8`
