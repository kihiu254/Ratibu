# Ratibu

Ratibu is a multi-platform chama management workspace with web, mobile, and
Supabase backend code in one repository. The active apps cover onboarding, KYC,
group management, meetings, contributions, referrals, notifications, and
M-Pesa-powered payment flows.

## Workspace Layout

- `pesachama-web-new/`: React 19 + Vite web app for landing pages, dashboard,
  onboarding, and admin tools.
- `pesachama-backend/`: Supabase project with SQL migrations and Edge Functions
  for OTP, M-Pesa, USSD, payouts, meetings, and automation tasks.
- `ratibu_mobile/`: Flutter mobile app using Riverpod, GoRouter, Supabase, and
  Firebase Messaging.
- `documentation/`: architecture notes, migration guides, API docs, and setup
  references.
- `pesachama_mobile/`: legacy mobile folder kept only for historical context.

## Core Capabilities

- Chama discovery, creation, and member management
- Digital contribution tracking and payment prompts
- M-Pesa STK push, callbacks, QR generation, and standing orders
- KYC onboarding and OTP verification
- Meetings, referrals, rewards, penalties, and admin operations
- Web push and mobile notifications

## Tech Stack

- Web: React, TypeScript, Vite, Tailwind CSS, Framer Motion, React Router
- Mobile: Flutter, Riverpod, GoRouter, Supabase Flutter, Firebase Messaging
- Backend: Supabase Auth, Postgres, Storage, Realtime, Edge Functions
- Payments: Safaricom Daraja API and USSD integrations

## Quick Start

### Requirements

- Node.js 20+
- npm 10+
- Flutter 3.x
- Supabase CLI

### Web

```bash
cd pesachama-web-new
npm install
cp .env.example .env.local
npm run dev
```

### Backend

```bash
cd pesachama-backend
npm install
supabase start
```

### Mobile

```bash
cd ratibu_mobile
flutter pub get
flutter run
```

## Recommended Next Steps

- Read `documentation/architecture.md` for the current system layout.
- Use `pesachama-web-new/.env.example` as the source of truth for web
  environment variables.
- Review `documentation/MPESA_INTEGRATION_GUIDE.md` before configuring payment
  secrets in a real environment.

## Notes

- Generated analysis logs from Flutter should stay out of version control.
- External callback functions must not require Supabase JWT verification.
- Never commit real payment credentials or service secrets to this repository.
