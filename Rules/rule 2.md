# HAAJARI MANAGER — AI CODING AGENT MASTER RULES

You are working on an existing production-oriented application called
"Haajari Manager".

Your job is to improve, debug, optimize, and extend the existing
application WITHOUT unnecessarily breaking or rewriting working features.

==================================================
RULE 1 — UNDERSTAND BEFORE MODIFYING
==================================================

NEVER start changing code immediately.

First inspect the existing architecture.

Understand:

Frontend:
- React Native
- Expo
- React Query
- Axios
- Navigation
- Local storage/cache
- Socket.IO
- Authentication
- Existing UI components

Backend:
- Node.js
- Express.js
- MongoDB
- Mongoose
- REST APIs
- Socket.IO
- Authentication
- Existing controllers/services/models

Before making changes, identify the relevant files and understand how
the existing feature currently works.

==================================================
RULE 2 — DO NOT REWRITE THE PROJECT
==================================================

DO NOT rewrite the application from scratch.

DO NOT replace the existing architecture with another architecture.

DO NOT migrate:
- MongoDB → MySQL
- React Native → another framework
- Expo → another framework
- React Query → another data library
- Socket.IO → another realtime system

unless explicitly requested.

Preserve the existing technology stack.

==================================================
RULE 3 — MINIMUM CHANGE PRINCIPLE
==================================================

Make the smallest safe change that solves the requested problem.

If only one component needs modification, do not modify ten unrelated
components.

If only one API needs optimization, do not rewrite the entire backend.

Avoid unnecessary refactoring.

==================================================
RULE 4 — NEVER REMOVE EXISTING FEATURES
==================================================

Never remove or disable existing functionality unless explicitly asked.

Important existing features include:

- Login
- Mobile OTP authentication
- Google Sign-In
- Password authentication
- Forgot password
- Worker management
- Add worker
- Edit worker
- Delete worker
- Attendance
- Present
- Absent
- Half Day
- Overtime
- Advance
- Payments
- Reports
- Dashboard
- Site Management
- GPS/location functionality
- Socket.IO
- Offline/sync functionality
- Export functionality
- Existing subscription features
- Existing security features

Do not break one feature while fixing another.

==================================================
RULE 5 — AUTHENTICATION IS HIGH RISK
==================================================

Authentication must be treated as critical infrastructure.

Before modifying authentication, inspect the entire authentication flow.

Never accidentally break:

- Mobile login
- Password login
- Google Sign-In
- JWT
- Token storage
- Refresh token handling
- Logout
- Forgot password
- Session persistence

Do not remove Google Sign-In configuration.

Do not change package name/application ID.

Current Android package:

com.haajari.app

Do not change it unless explicitly instructed.

==================================================
RULE 6 — DATABASE
==================================================

The application uses:

MongoDB + Mongoose

Do NOT introduce MySQL.

Do not change database structure unnecessarily.

Before changing a schema:

1. Inspect existing schema.
2. Inspect all controllers using it.
3. Inspect all APIs using it.
4. Check existing data compatibility.
5. Check indexes.
6. Check frontend expectations.

Never delete existing production data.

Never run destructive database commands.

Never drop collections.

Never reset the database.

==================================================
RULE 7 — API CONTRACT
==================================================

Treat existing API contracts as stable.

Before changing:

GET /...
POST /...
PUT /...
PATCH /...
DELETE /...

inspect all frontend consumers.

Do not rename an endpoint or change its response structure unless
explicitly required.

If an API response must change, update every affected consumer safely.

==================================================
RULE 8 — PERFORMANCE
==================================================

Performance optimization must be evidence-based.

DO NOT randomly add:

- useMemo
- useCallback
- React.memo
- caching
- setInterval
- polling
- debounce
- throttling

First identify the actual bottleneck.

Measure or trace:

Frontend
→ API
→ Backend
→ MongoDB
→ Response
→ React rendering

Then optimize the actual bottleneck.

==================================================
RULE 9 — NO RANDOM REFRESH FIXES
==================================================

If the application is repeatedly refreshing:

DO NOT simply disable all refetching.

Investigate:

- React Query
- staleTime
- refetchOnMount
- refetchOnWindowFocus
- refetchInterval
- invalidateQueries
- refetchQueries
- useEffect
- useFocusEffect
- AppState
- Navigation listeners
- Socket.IO events

Find the root cause first.

==================================================
RULE 10 — SOCKET.IO
==================================================

Never create duplicate Socket.IO listeners.

Every listener must have appropriate cleanup.

Example:

socket.on("event", handler)

must be paired appropriately with:

socket.off("event", handler)

Check whether listeners are being registered repeatedly when screens
mount or gain focus.

Do not remove Socket.IO functionality just to stop refreshes.

==================================================
RULE 11 — UI
==================================================

Do not redesign the UI unless the user explicitly asks for a UI change.

Preserve:

- Haajari branding
- Existing colors
- Existing navigation
- Existing typography
- Existing visual identity
- Existing user flows

When the user asks for a UI improvement, change ONLY the requested area.

Do not redesign unrelated screens.

==================================================
RULE 12 — USER EXPERIENCE
==================================================

The user should not unnecessarily wait for the entire application to
synchronize.

Prefer:

USER ACTION
↓
IMMEDIATE UI FEEDBACK
↓
BACKGROUND API REQUEST
↓
SERVER CONFIRMATION
↓
TARGETED DATA UPDATE

Avoid:

USER ACTION
↓
FULL APPLICATION REFRESH
↓
MULTIPLE API REQUESTS
↓
LONG LOADING
↓
USER CAN CONTINUE

==================================================
RULE 13 — LOADING STATES
==================================================

Every loading state must have a purpose.

Avoid:

- Infinite spinners
- Full-screen loaders for small operations
- Repeated loading animations
- Loading → refresh → loading loops

If only one button is processing, only that button should show loading
where possible.

Do not block the entire application unnecessarily.

==================================================
RULE 14 — ERROR HANDLING
==================================================

Never expose raw technical errors to normal users.

Bad:

"AxiosError: ERR_NETWORK..."

Bad:

"MongoServerError..."

Bad:

"TypeError: undefined..."

Instead provide a user-friendly message.

However, preserve detailed technical errors in development logs where
appropriate.

==================================================
RULE 15 — SECURITY
==================================================

Never expose:

- API secrets
- JWT secrets
- Database credentials
- Google client secrets
- Email service API keys
- Private keys
- Environment secrets

Never hardcode production secrets into source code.

Never commit .env files containing secrets.

==================================================
RULE 16 — GOOGLE SIGN-IN
==================================================

Google Sign-In is already configured.

Do not randomly change:

- Android package name
- SHA-1
- SHA-256
- OAuth client configuration
- Web Client ID
- Android Client ID
- Google services configuration

If Google Sign-In breaks, first diagnose the exact configuration mismatch.

Do not generate random Client IDs.

==================================================
RULE 17 — EXPO / EAS
==================================================

Respect the existing Expo/EAS architecture.

Do not randomly run:

expo prebuild --clean

Do not delete:

android/
ios/

unless explicitly instructed.

Before changing native configuration, inspect:

- app.json/app.config
- package.json
- eas.json
- android/
- ios/
- plugins
- native dependencies

Do not create configuration conflicts between app.json and native
projects.

==================================================
RULE 18 — DEPENDENCIES
==================================================

Do not install packages just because they might help.

Before installing a package:

1. Check whether the project already has an equivalent dependency.
2. Check compatibility with the current Expo SDK.
3. Check whether the package is actually necessary.
4. Explain why it is needed.

Avoid unnecessary dependency growth.

==================================================
RULE 19 — FILE CHANGES
==================================================

Before modifying files, identify:

1. Which files are relevant.
2. Why each file needs modification.
3. What the modification will accomplish.

After modification, report:

FILE:
CHANGE:
REASON:

Do not modify unrelated files.

==================================================
RULE 20 — BACKUP / SAFETY
==================================================

Before major changes:

- Check git status.
- Check current branch.
- Check uncommitted changes.
- Do not overwrite unrelated user work.

Never discard existing changes using commands such as:

git reset --hard

unless explicitly instructed.

==================================================
RULE 21 — TEST AFTER EVERY CHANGE
==================================================

After implementing a change:

1. Run the appropriate type check.
2. Run lint if configured.
3. Run tests if available.
4. Run Expo validation where appropriate.
5. Verify the affected feature manually if possible.

Do not assume that a successful build means the feature works.

==================================================
RULE 22 — REGRESSION CHECK
==================================================

After any major change, verify important existing flows.

At minimum check:

✓ App starts
✓ Login works
✓ Mobile authentication works
✓ Google Sign-In works
✓ Logout works
✓ Workers load
✓ Add Worker works
✓ Edit Worker works
✓ Delete Worker works
✓ Attendance loads
✓ Attendance marking works
✓ Payments work
✓ Reports work
✓ Navigation works
✓ Socket.IO works
✓ No infinite refresh
✓ No infinite loading

==================================================
RULE 23 — DO NOT CLAIM SUCCESS WITHOUT PROOF
==================================================

Never say:

"Fixed."

unless the issue was actually verified.

Instead report:

- What was found
- What was changed
- What was tested
- What remains unverified

Never invent test results.

==================================================
RULE 24 — ASK BEFORE HIGH-RISK CHANGES
==================================================

If a proposed change could:

- Delete data
- Change database schema
- Change authentication
- Change package/application ID
- Change production API contracts
- Remove existing functionality
- Change native Android/iOS configuration
- Require a new production service

STOP and explain the risk before proceeding.

==================================================
RULE 25 — PERFORMANCE PROJECT ORDER
==================================================

When working on performance, follow this order:

STEP 1:
Attendance opening speed

STEP 2:
Workers opening speed

STEP 3:
Add Worker speed

STEP 4:
Attendance marking speed

STEP 5:
Remove automatic refresh loops

STEP 6:
Reduce duplicate API requests

STEP 7:
Optimize MongoDB queries/indexes

STEP 8:
Optimize Attendance grid rendering

STEP 9:
Background synchronization

STEP 10:
Offline/cache strategy

Do not jump ahead unless the current step requires it.

==================================================
RULE 26 — ATTENDANCE IS HIGH PRIORITY
==================================================

Attendance is one of the most important parts of Haajari.

Never sacrifice:

- Attendance accuracy
- Attendance history
- Present/Absent/Half Day
- Overtime
- Advance
- GPS/location
- Payment calculations

for performance.

Performance improvements must preserve data correctness.

==================================================
RULE 27 — WORKER DATA
==================================================

Worker creation must be fast and reliable.

Do not make Add Worker trigger unnecessary full-app refreshes.

After successful worker creation:

- Update the Workers UI
- Keep existing cached data where possible
- Synchronize only what is necessary

Do not make the user wait for unrelated dashboard/summary requests.

==================================================
RULE 28 — OFFLINE / NETWORK
==================================================

Do not assume the user's network is always fast.

The application should eventually support a resilient experience where
appropriate.

However, do not implement a new offline architecture unless explicitly
requested.

First optimize the existing online flow.

==================================================
RULE 29 — CODE QUALITY
==================================================

Prefer:

- Clear code
- Small focused changes
- Existing project patterns
- Reusable components
- Proper error handling
- Proper cleanup
- Type safety

Avoid:

- Duplicate code
- Temporary hacks
- Magic numbers
- Dead code
- Commented-out abandoned implementations
- Unnecessary abstractions

==================================================
RULE 30 — FINAL REPORT FORMAT
==================================================

After completing any task, provide:

## What I inspected
...

## Root cause
...

## Changes made
...

## Files changed
...

## Tests performed
...

## Result
...

## Remaining risks
...

If nothing was changed, clearly say:

"No code changes were made."

==================================================
FINAL RULE
==================================================

DO NOT optimize for the appearance of progress.

Optimize for:

CORRECTNESS
+
STABILITY
+
PERFORMANCE
+
SECURITY
+
USER EXPERIENCE

The existing Haajari Manager application is more important than making
large amounts of code changes.

Understand first.
Measure where possible.
Change minimally.
Test carefully.
Preserve existing functionality.
