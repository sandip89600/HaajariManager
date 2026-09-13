# Haajari Manager

> Construction workforce and site management made simple.

Haajari Manager is a construction workforce and site management application designed for contractors, builders, site supervisors, and construction teams.

It helps manage workers, attendance, wages, advances, construction sites, daily work updates, and reports from one place.

---

## 🚧 Core Features

### 👷 Worker Management
- Add and manage workers
- Worker unique ID
- Daily wage management
- Active / inactive workers
- Worker profile management
- Contractor-to-worker relationship

### 🕐 Attendance Management
- Daily attendance
- Present
- Absent
- Half Day
- Overtime
- Attendance history
- Monthly attendance grid
- Contractor and worker attendance synchronization

### 💰 Salary & Wage Management
- Attendance-based wage calculation
- Daily wages
- Advance payments
- Net payable balance
- Salary summaries
- Salary reports

### 🏗️ Site Management
- Multiple construction sites
- Site information
- Worker/site association
- Daily site activity

### 📸 Daily Work Updates
- Daily work photos
- Work descriptions
- Work progress
- Date and time
- Location/GPS support
- Construction work proof

### 📊 Reports
- Daily attendance reports
- Monthly attendance
- Worker salary reports
- Site work reports
- PDF reports
- CSV export

### 🌐 Language Support
- English
- Hindi
- Marathi
- Global language switching
- Language preference persistence

### 📶 Online & Offline Support
Haajari Manager is designed for real construction environments where internet connectivity may be unreliable.

Supported offline workflows include:
- View previously synchronized data
- Mark attendance
- Worker updates
- Daily work updates
- Offline data queue
- Automatic synchronization when internet returns

### 🔐 Authentication
- Mobile/OTP authentication
- Secure sessions
- Password recovery
- Role-based access

---

## 👥 User Roles

### Contractor
Contractors can:
- Manage workers
- Manage construction sites
- Mark attendance
- Manage wages and advances
- Track daily work
- View reports
- Monitor site activities

### Labour / Worker
Workers can:
- View their worker profile
- View attendance
- View salary information
- View relevant work information
- Receive updates from the contractor

---

## 🎯 Product Vision

Haajari Manager is not designed to be just another attendance application.

### It's about daily construction control.

> **सिर्फ हाजरी नहीं — रोज़ के काम का भी Proof.**

The long-term goal is to help construction businesses understand:

- Who worked?
- Where did they work?
- How much work was completed?
- What happened on the site?
- How much should each worker be paid?

---

## 🛠️ Technology

### Frontend
- React Native
- Expo
- JavaScript / TypeScript
- Expo ecosystem

### Backend
- Node.js
- Express.js
- REST APIs

### Database
- PostgreSQL

### Authentication
- OTP-based authentication
- Secure token-based sessions

### Deployment
- Backend deployed on Render
- Mobile application prepared for Android deployment

---

## 📱 Application Flow

```text
Language Selection
        ↓
Authentication
        ↓
Role Detection
        ↓
┌───────────────────┐
│                   │
Contractor       Labour
│                   │
↓                   ↓
Dashboard        Dashboard
│                   │
├─ Workers          ├─ Profile
├─ Attendance       ├─ Attendance
├─ Sites            ├─ Salary
├─ Work Updates     └─ Work Info
├─ Salary
└─ Reports
