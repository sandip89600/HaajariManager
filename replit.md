# Haajari App - Labour Attendance Manager

## Overview
A mobile-first Expo React Native application for managing labour attendance and payments at construction sites. The app supports multiple worker categories, daily attendance tracking with color-coded cells, payment calculations, multi-language support, and a modern CRED/Apple-style settings interface.

## Current State
- **Version:** 1.0.0
- **Status:** Production-ready MVP
- **Last Updated:** March 2026

## Tech Stack
- **Framework:** React Native with Expo SDK 54
- **Navigation:** React Navigation 7+
- **Storage:** AsyncStorage for offline data persistence
- **Styling:** React Native StyleSheet with custom theme system
- **Animations:** React Native Reanimated + Haptics
- **Theme:** Live-switching via React Context (ThemeProvider in contexts/ThemeContext.tsx)

## Key Features
1. **Two-tier Authentication:** Admin (sandeep@gmail.com / sandeep121) + User signup/login
2. **Guest Mode:** "Browse as Guest" skip button on login — enter app without credentials
3. **Live Theme Switching:** Light / Dark / System themes switch instantly without reload
4. **Worker Management:** Add, edit, delete workers with categories (Labour, Bai, Mistri, Bandkam, Plaster, Tiles, Sutar)
5. **Attendance Grid:** Spreadsheet-style grid with dates as columns and workers as rows
6. **Attendance Marking:** P (Present), A (Absent), H (Half Day), or custom amounts
7. **Color Coding:** Green=Present, Red=Absent, Yellow=Half Day, Blue=Amount
8. **Payment Summary:** Auto-calculation of days worked and total payment per worker
9. **Multi-Language:** English and Hindi support with easy switching
10. **Offline-First:** All data persisted locally with AsyncStorage
11. **CRED/Apple Settings:** Grouped settings cards, iOS-style bottom sheet modals

## Project Architecture

### Screens
- `screens/LoginScreen.tsx` - Authentication with language selector + Skip/Guest button
- `screens/SignupScreen.tsx` - User registration
- `screens/AttendanceScreen.tsx` - Main attendance grid with month selector
- `screens/WorkersScreen.tsx` - Worker list with FAB for adding
- `screens/AddWorkerScreen.tsx` - Add/Edit worker modal
- `screens/SummaryScreen.tsx` - Monthly payment summary
- `screens/SettingsScreen.tsx` - CRED/Apple-style settings; handles guest mode banner

### Navigation
- `navigation/RootNavigator.tsx` - Auth flow (Login vs Main, supports isGuest)
- `navigation/MainTabNavigator.tsx` - Tab navigation (AdminTabs vs UserTabs) + modal stack

### Context Providers (in App.tsx)
1. `ThemeProvider` (contexts/ThemeContext.tsx) — live theme, wraps everything
2. `LanguageContext` (hooks/useLanguage.ts) — i18n
3. `AuthContext` (hooks/useAuth.ts) — login state + guest mode

### Data Storage
- `utils/storage.ts` - AsyncStorage wrapper for workers, attendance, users, settings

### Theme System
- `contexts/ThemeContext.tsx` - React Context with live `setThemeMode`, `theme`, `isDark`
- `hooks/useTheme.ts` - Re-exports `useTheme` from contexts/ThemeContext
- `constants/theme.ts` - Colors (light + dark), spacing, typography, shadows
- Orange (#FF6B35) and Dark Blue (#1E3A5F) primary colors

### Internationalization
- `constants/i18n/` - English and Hindi translations
- `hooks/useLanguage.ts` - Language context and hook

## Admin Credentials
- Email: sandeep@gmail.com
- Password: sandeep121

## User Preferences
- Mobile-first responsive design
- CRED/Apple style UI — grouped cards with rounded corners, tinted icon backgrounds
- Touch-friendly 56dp cell sizes
- Haptic feedback on interactions
- Dark/light/system theme with instant live switching
