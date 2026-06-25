---
name: App.tsx provider nesting structure
description: Required order of providers in App.tsx to avoid hook-outside-context crashes
---

# App.tsx Provider Structure

## The Rule
```
SafeAreaProvider > GestureHandlerRootView > KeyboardProvider > ThemeProvider > ErrorBoundary > AppInner
```

**Why:** ErrorBoundary's `ErrorFallback` component uses `useTheme()`. If ErrorBoundary wraps ThemeProvider, the fallback renders outside ThemeContext and crashes with "useTheme must be used inside ThemeProvider."

**How to apply:** Any component that uses hooks from a Context provider must be nested INSIDE that provider — including error boundary fallbacks.

## Additional Notes
- ThemeProvider returns `null` while `isLoaded` is false (intentional, prevents flash)
- AppInner handles auth state and renders RootNavigator
