---
name: i18n type system
description: How TranslationKeys is typed and how to add new string sections
---

# i18n Type System

## The Rule
`constants/i18n/index.ts` exports `TranslationKeys = typeof en` (inferred from the English JSON).

**Why:** This means adding new keys/sections to `en.json` automatically adds them to the TypeScript type. No manual interface updates needed.

**How to apply:**
1. Add new key to `en.json` and `hi.json` (keep in sync)
2. TypeScript will immediately recognize `t.newSection.newKey` without any other changes
3. The same type is used for both languages via `getTranslation(language): TranslationKeys`

## Current Sections
`app, auth, tabs, attendance, workers, categories, summary, settings, gps, notifications, admin, months, export, payment, history, common`
