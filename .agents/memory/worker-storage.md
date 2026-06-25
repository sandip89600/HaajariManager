---
name: Worker and AttendanceRecord storage interfaces
description: Extended data models for workers and attendance records
---

# Worker Storage Architecture

## Worker Interface
Extended with optional profile fields:
- `phone?` — contact number
- `address?` — village/city
- `notes?` — freeform notes
- `photoUri?` — local file URI from expo-image-picker

## AttendanceRecord Interface
Extended with optional GPS data:
- `location?` — `{ latitude, longitude, accuracy? }`
- `timestamp?` — Unix ms when attendance was marked

## Storage Keys
- `@haajari/workers` — worker list
- `@haajari/attendance` — attendance records
- `@haajari/payments` — payment records
- `@haajari/notification_settings` — NotificationSettings object

**Why:** GPS and photos are optional so existing records remain valid without migration.
