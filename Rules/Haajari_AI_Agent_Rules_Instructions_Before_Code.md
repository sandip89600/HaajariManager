# Haajari AI Agent — Rules & Instructions Before Writing Code

## IMPORTANT

These rules must be followed **before writing, modifying, deleting, or generating any code** in the Haajari application.

The agent must treat the existing Haajari codebase as a real production application.

Do not start coding immediately.

---

# 1. INSPECT FIRST — NEVER GUESS

Before writing code:

- Inspect the complete relevant project structure.
- Identify the frontend and backend.
- Identify the database and existing models.
- Identify authentication and authorization.
- Identify existing API routes.
- Identify controllers and services.
- Identify middleware.
- Identify existing AI/HAI implementation.
- Identify worker, attendance, salary, payment, advance, project, and report functionality.
- Identify existing environment variables.
- Identify existing dependencies.
- Identify existing error handling.
- Identify existing logging.
- Identify existing tests.

### Rule

**If you have not inspected the relevant existing code, do not modify it.**

Never assume:

- A file exists.
- A model exists.
- An API exists.
- A function works a certain way.
- A variable has a specific name.
- A database field has a specific meaning.

Verify it from the codebase.

---

# 2. UNDERSTAND BEFORE IMPLEMENTING

Before making changes, understand:

- How data flows through the application.
- How authentication works.
- How users are identified.
- How companies/tenants are identified.
- How permissions work.
- How MongoDB queries are performed.
- How business calculations are implemented.
- How frontend requests reach the backend.
- How errors are returned.
- How existing AI functionality works.

Do not replace an existing working implementation simply because another approach looks cleaner.

---

# 3. CREATE A PLAN BEFORE CODE

Before implementation:

1. Identify the exact requirement.
2. Identify existing code that can be reused.
3. Identify files that need modification.
4. Identify files that need to be created.
5. Identify possible side effects.
6. Identify security implications.
7. Identify testing requirements.

Keep the plan focused on the requested feature.

Do not perform unrelated refactoring.

---

# 4. PRESERVE EXISTING FUNCTIONALITY

The existing Haajari application must continue working.

Do not break:

- Login
- Authentication
- User management
- Worker management
- Attendance
- Salary
- Payments
- Advances
- Projects
- Reports
- Dashboard
- Exports
- Notifications
- Socket.IO
- Existing AI features
- Existing APIs

### Rule

**New functionality must integrate with existing functionality, not destroy or replace it.**

---

# 5. DO NOT CREATE DUPLICATES

Before creating anything, search the repository.

Do not create duplicate:

- Models
- Controllers
- Services
- Routes
- Middleware
- Utility functions
- API endpoints
- Database schemas
- Authentication logic
- AI services

If equivalent functionality already exists, reuse or extend it.

---

# 6. MINIMAL SAFE CHANGES

Make the smallest safe change required to implement the feature.

Do not:

- Rewrite unrelated files.
- Reformat the entire project.
- Rename unrelated variables.
- Change the project's architecture unnecessarily.
- Upgrade dependencies without a reason.
- Replace working libraries without justification.

Every modification should have a clear purpose.

---

# 7. SECURITY FIRST

Security must never be sacrificed for convenience.

Always preserve:

- Authentication
- Authorization
- Tenant isolation
- Role permissions
- Input validation
- Rate limiting
- Secure headers
- CORS rules
- Database sanitization
- XSS protection

Never bypass existing security middleware just to make an AI feature work.

---

# 8. TENANT ISOLATION IS MANDATORY

Haajari is a multi-user/multi-company application.

Never allow one company's data to appear in another company's AI response.

Every relevant database retrieval must respect the authenticated user's tenant/company.

### Never trust:

```text
tenantId
companyId
userId
```

when supplied directly by the client for authorization purposes.

Use the authenticated server-side identity.

---

# 9. AI MUST NOT HAVE UNRESTRICTED DATABASE ACCESS

Never allow the AI model to directly execute arbitrary MongoDB queries.

Never implement:

```text
AI → Raw MongoDB Query → Database
```

Use:

```text
AI
↓
Approved Tool
↓
Validated Parameters
↓
Authorized Service
↓
Tenant-Filtered Database Query
```

Only explicitly approved tools may access application data.

---

# 10. AI MUST NOT INVENT HAAJARI DATA

For business information, the database is the source of truth.

The AI must never invent:

- Worker names
- Attendance
- Salary
- Payments
- Advances
- Projects
- Reports
- Dates
- Amounts
- User information

If data cannot be found, clearly state that the information is unavailable.

Do not make assumptions that look like real database results.

---

# 11. USE RAG CORRECTLY

For structured Haajari data:

- Workers → database retrieval
- Attendance → database retrieval
- Payments → database retrieval
- Salary → backend calculation
- Advances → database retrieval
- Projects → database retrieval
- Reports → backend aggregation

Do not automatically put every database record into a vector database.

Use semantic/vector retrieval only where it provides real value, such as:

- Documentation
- Policies
- FAQs
- Help content
- Notes
- Text documents

---

# 12. BACKEND CALCULATIONS ARE AUTHORITATIVE

Important calculations must be performed by backend business logic.

Examples:

- Full working days
- Half days
- Overtime
- Daily wages
- Monthly salary
- Advances
- Payments
- Pending payments
- Totals
- Reports

Do not depend on the AI model to perform critical financial calculations.

The AI should explain verified backend results.

---

# 13. NEVER SEND UNNECESSARY DATA TO AI

Retrieve only the data required for the current request.

Bad:

```text
User asks about Ramesh
↓
Retrieve all workers
↓
Retrieve all attendance
↓
Retrieve all payments
↓
Send everything to AI
```

Good:

```text
Identify Ramesh
↓
Apply authenticated tenant
↓
Filter requested date/month
↓
Retrieve required fields
↓
Calculate required values
↓
Send minimal context to AI
```

This improves:

- Security
- Performance
- Accuracy
- Cost
- Privacy

---

# 14. VALIDATE ALL AI TOOL INPUTS

Never trust parameters generated by the AI.

Validate:

- Worker ID
- User ID
- Project ID
- Payment amount
- Advance amount
- Date
- Month
- Action type
- Pagination
- Search parameters

Use backend validation before executing any tool.

---

# 15. WRITE ACTIONS REQUIRE EXTRA SAFETY

Read operations and write operations must be treated differently.

Examples of write operations:

- Add worker
- Edit worker
- Delete worker
- Mark attendance
- Create payment
- Create advance
- Update salary
- Change project information

For sensitive operations:

1. Understand the request.
2. Identify the target.
3. Verify authorization.
4. Validate the parameters.
5. Ask for confirmation when required.
6. Execute the backend operation.
7. Verify the database result.
8. Report the actual result.

Never claim success before backend confirmation.

---

# 16. NEVER DELETE DATA WITHOUT CLEAR REQUIREMENT

Do not delete:

- Database records
- Files
- Existing APIs
- Existing components
- Existing services
- Existing configuration

unless the requirement explicitly requires deletion and the impact has been checked.

Prefer safe alternatives where possible.

---

# 17. DO NOT CHANGE DATABASE SCHEMA RANDOMLY

Before modifying a Mongoose schema:

- Search for all usages.
- Check controllers.
- Check services.
- Check API responses.
- Check frontend dependencies.
- Check indexes.
- Check existing data compatibility.

Do not rename or remove fields without understanding the migration impact.

---

# 18. DEPENDENCY RULES

Before installing a new package:

1. Check `package.json`.
2. Search whether an existing dependency already provides the required functionality.
3. Prefer existing dependencies.
4. Add a new dependency only when necessary.
5. Do not install packages just because they are popular.

If a new package is required, explain why it is needed.

---

# 19. ENVIRONMENT VARIABLES

Never hardcode:

- API keys
- AI provider keys
- Database credentials
- JWT secrets
- Private tokens
- Passwords

Use environment variables.

If a new environment variable is required:

- Add it to `.env.example`.
- Do not add the real secret.
- Keep secrets server-side.

Never commit `.env`.

---

# 20. ERROR HANDLING

Every new feature must have proper error handling.

Handle:

- Invalid input
- Missing data
- Unauthorized access
- Database errors
- AI provider errors
- Timeout
- Rate limits
- Network failures
- Tool failures
- Unexpected errors

Do not expose raw stack traces, database errors, provider errors, or secrets to users.

Return safe user-friendly errors.

---

# 21. LOGGING

Use the existing logging system if one exists.

Logs should help developers understand:

- What happened.
- Which request failed.
- Which tool was used.
- Which operation failed.
- How long retrieval took.
- How long AI processing took.

Never log:

- Passwords
- API keys
- JWT tokens
- Database credentials
- Private secrets

Avoid excessive production console logging.

---

# 22. PERFORMANCE

Before implementing a database query, consider:

- Indexes
- Query filters
- Projections
- Aggregations
- Pagination
- Caching
- N+1 queries
- Large result sets

Never retrieve thousands of records when a filtered query can return the required result.

Do not send large unnecessary contexts to the AI.

---

# 23. FRONTEND RULES

When modifying the frontend:

- Follow the existing design system.
- Reuse existing components.
- Reuse existing API utilities.
- Reuse existing authentication state.
- Preserve responsive behavior.
- Handle loading states.
- Handle empty states.
- Handle errors.
- Avoid unrelated UI changes.

Do not redesign existing screens unless explicitly requested.

---

# 24. API RULES

Before creating an API:

1. Search existing routes.
2. Search existing controllers.
3. Search existing services.
4. Check whether the endpoint already exists.
5. Follow the existing API naming convention.
6. Follow the existing response format.
7. Apply authentication.
8. Apply authorization.
9. Validate input.
10. Apply tenant isolation.

Do not create duplicate endpoints.

---

# 25. CODE STYLE

Follow the existing project's coding style.

Use:

- Clear names
- Modular functions
- Reusable services
- Consistent error handling
- Consistent response structure
- Useful comments

Avoid:

- Giant functions
- Giant controllers
- Duplicate logic
- Magic values
- Dead code
- Unused imports
- Temporary hacks
- Debug code

---

# 26. DO NOT STOP AT SKELETON CODE

Do not consider the task complete after creating:

- Empty files
- Placeholder functions
- TODO comments
- Fake API responses
- Mock database results
- Hardcoded AI responses

The implementation must actually work with the existing application.

---

# 27. TEST AFTER EVERY MAJOR CHANGE

After implementing an important component:

1. Run the relevant tests.
2. Run lint if available.
3. Run the build if appropriate.
4. Check imports.
5. Check API behavior.
6. Check database behavior.
7. Fix errors immediately.

Do not continue while known errors remain unless there is a documented reason.

---

# 28. REGRESSION CHECK

After implementation, verify that existing functionality still works.

At minimum verify the relevant parts of:

- Authentication
- Worker management
- Attendance
- Salary
- Payments
- Advances
- Projects
- Reports
- Dashboard
- Exports
- Existing AI
- Notifications
- Socket.IO

---

# 29. DO NOT HIDE ERRORS

If implementation fails:

- Identify the root cause.
- Fix it.
- Test the fix.
- Do not silently disable the feature.
- Do not remove functionality just to make tests pass.
- Do not replace real logic with fake responses.

---

# 30. DO NOT MAKE UNRELATED IMPROVEMENTS

If the task is:

> "Implement Smart RAG Manager"

Do not automatically:

- Redesign the dashboard.
- Rewrite authentication.
- Change the payment system.
- Change the entire database structure.
- Upgrade every dependency.
- Rebuild unrelated screens.

Stay within scope.

---

# 31. PRESERVE USER WORK

Before editing:

- Check Git status.
- Inspect existing uncommitted changes.
- Do not overwrite unrelated work.
- Do not reset the repository.
- Do not delete user-created files without checking their usage.

Existing user changes must be treated as intentional unless proven otherwise.

---

# 32. PRODUCTION-READY STANDARD

Code is considered complete only when:

- It integrates with the existing application.
- Authentication works.
- Authorization works.
- Tenant isolation works.
- Input validation works.
- Errors are handled.
- Important calculations are backend-controlled.
- AI cannot access arbitrary database data.
- Tests pass.
- Build succeeds where applicable.
- No secrets are exposed.
- Existing functionality remains intact.

---

# 33. FINAL CHECK BEFORE SAYING "DONE"

Before reporting completion, verify:

- [ ] Requirement fully implemented
- [ ] Existing code inspected
- [ ] Existing functionality preserved
- [ ] No duplicate functionality created
- [ ] Authentication verified
- [ ] Authorization verified
- [ ] Tenant isolation verified
- [ ] Input validation verified
- [ ] AI access restricted
- [ ] Database queries optimized
- [ ] Important calculations verified
- [ ] Errors handled
- [ ] Tests executed
- [ ] Build/lint checked where available
- [ ] Secrets protected
- [ ] No unrelated files changed
- [ ] No placeholder implementation remains

---

# 34. FINAL RESPONSE TO USER

When the implementation is complete, report:

1. What was implemented.
2. Which files were created.
3. Which files were modified.
4. Which APIs were added/changed.
5. Which AI tools were added.
6. Security changes.
7. Tests performed.
8. Build/lint status.
9. Any remaining issues.
10. Any required environment variables.

Be factual.

Do not say "complete" if important parts are still placeholders or failing.

---

# FINAL RULE

> **DO NOT WRITE CODE UNTIL YOU HAVE INSPECTED AND UNDERSTOOD THE EXISTING CODEBASE.**

> **DO NOT BREAK EXISTING FUNCTIONALITY.**

> **DO NOT GUESS.**

> **DO NOT GIVE AI UNRESTRICTED DATABASE ACCESS.**

> **DO NOT TRUST CLIENT-SUPPLIED TENANT IDENTIFIERS.**

> **DO NOT INVENT DATABASE RESULTS.**

> **DO NOT CLAIM SUCCESS WITHOUT VERIFICATION.**

> **BUILD, TEST, VERIFY, THEN REPORT.**
