# Haajari App - Design Guidelines

## Architecture Decisions

### Authentication
**Auth Required** - The app explicitly requires login for owner/admin access.

**Implementation:**
- Email + Password OR Mobile + PIN authentication
- Store credentials securely using AsyncStorage with encryption
- No SSO needed for this construction site management context
- Mock auth flow with local state persistence
- Login screen includes:
  - App logo and name
  - Email/Mobile input field
  - Password/PIN input field
  - "Remember Me" toggle
  - Login button
  - Language selector (bottom)

**Account Management:**
- Settings screen includes logout with confirmation
- No account deletion needed (single admin/owner account)

### Navigation
**Tab Navigation** (4 tabs + floating action button)

**Tab Bar Structure:**
1. **Attendance** (home) - Main spreadsheet grid
2. **Workers** - Worker management list
3. **[FAB]** - Quick add worker or mark attendance
4. **Summary** - Monthly payment summary
5. **Settings** - Language, profile, month/year selector

**Information Architecture:**
- Linear flow: Login → Onboarding (language selection) → Main App (Tab Navigation)
- Modal screens: Add/Edit Worker, Manual Adjustment, Export Options

### Screen Specifications

#### 1. Login Screen
- **Purpose:** Authenticate owner/admin before app access
- **Layout:**
  - Custom header: App logo + "Haajari" wordmark centered
  - Scrollable form with:
    - Welcome text in selected language
    - Email/Mobile input with icon
    - Password/PIN input with show/hide toggle
    - Remember me checkbox
    - Primary login button (full width)
    - Language selector pills (EN | HI) at bottom
  - No tab bar, no navigation header
- **Safe Area:** Top: insets.top + Spacing.xl, Bottom: insets.bottom + Spacing.xl
- **Components:** TextInput, Checkbox, Button, LanguageSelector

#### 2. Attendance Grid Screen (Home Tab)
- **Purpose:** View and edit daily attendance in spreadsheet format
- **Layout:**
  - Transparent header with:
    - Left: Month/Year selector dropdown
    - Title: Current month name (e.g., "January 2024")
    - Right: Export icon button
  - Main content: Horizontal + vertical scrollable grid
    - Sticky top row: Dates 1-31
    - Sticky left column: Worker names
    - Grid cells: Attendance markers (P/A/1/2/amount)
  - Floating action button (bottom right): Quick add attendance
- **Safe Area:** Top: headerHeight + Spacing.xl, Bottom: tabBarHeight + Spacing.xl + 80 (for FAB)
- **Components:** ScrollView (horizontal + vertical), Grid cells, MonthYearPicker, FAB
- **Grid Specifications:**
  - Cell size: 56×56 dp (touch-friendly)
  - Sticky headers use elevation/shadow
  - Horizontal scroll snaps to columns

#### 3. Workers Screen (Tab 2)
- **Purpose:** Manage worker list (add, edit, delete, assign categories)
- **Layout:**
  - Default navigation header with:
    - Title: "Workers"
    - Right: Add worker "+" icon button
  - Scrollable list of worker cards:
    - Worker name (bold)
    - Category badge (color-coded)
    - Daily rate (₹/रु amount)
    - Edit/Delete icons (right)
- **Safe Area:** Top: Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- **Components:** FlatList, WorkerCard, CategoryBadge, IconButton

#### 4. Summary Screen (Tab 4)
- **Purpose:** View monthly payment totals for all workers
- **Layout:**
  - Default navigation header with:
    - Title: "Summary"
    - Right: Print/Export icon
  - Month/Year selector (top)
  - Scrollable summary list:
    - Worker name
    - Total present days (green pill)
    - Total half days (yellow pill)
    - Total absent days (red pill)
    - Total amount (large, bold, right-aligned)
- **Safe Area:** Top: Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- **Components:** MonthYearPicker, FlatList, SummaryCard, StatusPills

#### 5. Settings Screen (Tab 5)
- **Purpose:** Configure language, view profile, app preferences
- **Layout:**
  - Default navigation header: "Settings"
  - Scrollable form groups:
    - Profile section (admin name, icon)
    - Language selector (radio buttons: English, Hindi)
    - Default month/year for app launch
    - Logout button (destructive color)
- **Safe Area:** Top: Spacing.xl, Bottom: tabBarHeight + Spacing.xl
- **Components:** SettingsGroup, RadioButton, Button

#### 6. Add/Edit Worker Modal
- **Purpose:** Add new worker or edit existing worker details
- **Layout:**
  - Modal header:
    - Left: Cancel text button
    - Title: "Add Worker" or "Edit Worker"
    - Right: Save text button
  - Scrollable form:
    - Worker name input
    - Category picker (dropdown: Labour, Bai, Mistri, Plaster, Tiles, Sutar, Bandkam)
    - Daily rate input (numeric with currency symbol)
  - Submit/Cancel in header
- **Safe Area:** Top: insets.top + Spacing.xl, Bottom: insets.bottom + Spacing.xl
- **Components:** TextInput, Picker, NumericInput

---

## Design System

### Color Palette
**Primary Colors:**
- Primary Orange: `#FF6B35` (CTAs, active states, construction theme)
- Primary Dark Blue: `#1E3A5F` (headers, navigation, text)

**Attendance Status Colors:**
- Present Green: `#4CAF50`
- Absent Red: `#F44336`
- Half Day Yellow: `#FFC107`
- Amount Blue: `#2196F3`

**Neutral Colors:**
- Background: `#F5F5F5` (light gray)
- Surface White: `#FFFFFF`
- Text Primary: `#1E3A5F` (dark blue)
- Text Secondary: `#757575`
- Border/Divider: `#E0E0E0`

**Semantic Colors:**
- Success: `#4CAF50`
- Warning: `#FFC107`
- Error: `#F44336`
- Info: `#2196F3`

### Typography
**Font Family:** System default (San Francisco for iOS, Roboto for Android)

**Type Scale:**
- H1 (Screen Titles): 28sp, Bold, Dark Blue
- H2 (Section Headings): 20sp, SemiBold, Dark Blue
- H3 (Card Titles): 16sp, SemiBold, Dark Blue
- Body: 14sp, Regular, Text Primary
- Caption: 12sp, Regular, Text Secondary
- Button: 16sp, SemiBold, White/Primary

### Components

**Touchable Feedback:**
- Buttons: Scale animation (0.95) + opacity (0.7) on press
- List items: Light gray background (#F0F0F0) on press
- Grid cells: Subtle scale (0.98) on press

**Floating Action Button:**
- Size: 56×56 dp
- Color: Primary Orange
- Icon: White plus or relevant action icon
- Shadow (EXACT specifications):
  - shadowOffset: { width: 0, height: 2 }
  - shadowOpacity: 0.10
  - shadowRadius: 2
  - elevation: 4 (Android)
- Position: 16 dp from bottom right (above tab bar safe area)

**Grid Cells:**
- Border: 1px solid #E0E0E0
- Background colors based on attendance status
- Text: Centered, 14sp, white or dark text based on background
- Active cell: 2px border in Primary Orange

**Status Badges/Pills:**
- Pill shape (borderRadius: 12)
- Padding: 4×8 dp
- Small text: 11sp, SemiBold
- Background: Corresponding status color at 20% opacity
- Text: Corresponding status color at 100%

**Worker Cards:**
- Background: White
- Border radius: 8
- Padding: 16 dp
- Shadow: None (use subtle border instead for performance)
- Divider: 1px solid #E0E0E0

**Inputs:**
- Height: 48 dp (touch-friendly)
- Border: 1px solid #E0E0E0
- Border radius: 8
- Focused border: 2px solid Primary Orange
- Padding: 12 dp horizontal

### Icons
- **System Icons:** Use Feather icons from @expo/vector-icons
- **Common Icons:**
  - Attendance: `check-circle` (Present), `x-circle` (Absent), `clock` (Half day)
  - Navigation: `calendar`, `users`, `bar-chart-2`, `settings`
  - Actions: `plus`, `edit-2`, `trash-2`, `download`, `printer`
  - Header: `chevron-down` (dropdowns), `more-vertical` (menus)

### Assets Required

**Logo/Branding:**
1. **App Icon** - Construction hard hat with attendance checkmark (512×512 px)
   - Primary orange hard hat with dark blue checkmark overlay
   - Clean, minimal design suitable for small sizes

2. **Splash Screen Logo** - Same icon + "Haajari" wordmark
   - Wordmark in dark blue, custom/bold sans-serif

**Category Icons (Illustrative, optional):**
- Small worker type illustrations for empty states or onboarding
- Simple line art style in orange/blue theme

**No custom avatars needed** - Admin account only, use single system icon

### Accessibility
- Minimum touch target size: 48×48 dp
- Color contrast ratio: 4.5:1 for normal text, 3:1 for large text
- Language support: All UI text via i18n (en.json, hi.json)
- Labels in both languages for all interactive elements
- Visual + text feedback for attendance marking (color + letter)
- Support for larger text sizes (scale typography)
- Keyboard navigation for grid (optional enhancement)

### Offline Considerations
- Loading states when syncing data
- Visual indicator (icon in header) showing offline/online status
- Optimistic UI updates for attendance marking (instant feedback)
- Queue pending changes with visual badge/indicator