# Security Rules for MERN + MongoDB + React Native Agent

You MUST follow these rules for every piece of code you write or modify.
If a request conflicts with these rules, flag it instead of silently complying.

## 1. MongoDB / Mongoose
- NEVER build queries with raw string concatenation or `$where` using user input.
- ALWAYS use Mongoose schemas with strict typing — no `Schema({}, {strict: false})`.
- SANITIZE all req.body/req.query/req.params with `express-mongo-sanitize` 
  to strip `$` and `.` operators (prevents NoSQL injection like 
  `{"email": {"$gt": ""}}`).
- NEVER pass `req.query` or `req.body` directly into `.find()`, `.updateOne()`, 
  etc. Always whitelist specific fields.
- ALWAYS validate ObjectId format before querying: `mongoose.isValidObjectId(id)`.
- NEVER expose internal Mongoose `_id`/`__v` details unless required.

## 2. Authentication & Authorization
- Passwords: bcrypt only, cost factor >= 12. NEVER store plaintext or use MD5/SHA1.
- JWT: short-lived access tokens (15 min), httpOnly + secure refresh tokens 
  in cookies (not localStorage/AsyncStorage for refresh tokens).
- ALWAYS verify JWT signature + expiry server-side on every protected route.
- ALWAYS check resource ownership server-side (e.g., `if (doc.userId !== req.user.id)`) 
  — never trust a client-supplied user ID. This prevents IDOR.
- Rate-limit `/login`, `/register`, `/forgot-password`, `/otp` with 
  `express-rate-limit` (e.g., 5 attempts/15 min).
- Enforce MFA option for admin/privileged roles.

## 3. Express API Layer
- ALWAYS use `helmet()` for security headers.
- ALWAYS validate/sanitize input with `zod`, `joi`, or `express-validator` 
  before it touches business logic.
- NEVER return raw error stacks to the client — log internally, return 
  generic messages.
- ALWAYS set CORS to explicit allowed origins — never `origin: '*'` in production.
- Enforce HTTPS + `Strict-Transport-Security` header.
- ALWAYS use `express-rate-limit` globally + stricter limits on sensitive routes.

## 4. Secrets & Config
- NEVER hardcode API keys, DB URIs, or JWT secrets in code.
- ALWAYS use `.env` (gitignored) or a secrets manager (AWS Secrets Manager, Doppler).
- NEVER commit `.env` — verify `.gitignore` includes it before any commit.
- ALWAYS use different secrets per environment (dev/staging/prod).

## 5. React Native (client)
- NEVER store JWTs, refresh tokens, or sensitive data in AsyncStorage in plaintext 
  — use `react-native-keychain` or `expo-secure-store` (encrypted storage).
- NEVER hardcode API keys or secrets in the app bundle — they're extractable 
  from the APK/IPA. Proxy sensitive calls through your backend instead.
- ALWAYS validate/sanitize on the server too — client-side validation is UX only, 
  never a security boundary.
- Use certificate pinning for sensitive apps (banking, healthcare) to prevent 
  MITM via proxy tools.
- Disable debug/remote JS debugging in production builds.
- ALWAYS use HTTPS for all API calls — never `http://`.

## 6. Dependencies
- Run `npm audit` / `yarn audit` before every deploy; flag high/critical issues.
- Avoid abandoned/unmaintained packages for auth, crypto, or payment logic.
- Pin dependency versions in production (`package-lock.json` committed).

## 7. Logging & Monitoring
- Log authentication failures, rate-limit hits, and permission-denied events.
- NEVER log passwords, tokens, or full card numbers — even in debug logs.
- Include request IDs for traceability, not full user PII.

## 8. General Agent Behavior
- When writing any DB query, API route, or auth logic, explicitly state 
  which of the above rules apply and confirm you followed them.
- If unsure whether input is trusted, treat it as untrusted.
- Prefer explicit allowlists over denylists everywhere (fields, origins, roles).
- Flag any code you generate that stores tokens/secrets client-side insecurely.