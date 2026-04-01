# Ratibu System Architecture

## Overview

Ratibu is organized as a product workspace with three active delivery surfaces:

- a React web application for marketing, onboarding, dashboard, and admin tasks
- a Flutter mobile application for member-facing flows on Android and iOS
- a Supabase backend for auth, data, storage, realtime, and server-side logic

The web and mobile apps both depend on the same Supabase project and share core
entities such as users, chamas, transactions, meetings, payment requests,
referrals, and KYC documents.

## Application Layers

### Web Application

Location: `pesachama-web-new/`

- React 19 with Vite
- TypeScript
- React Router for public, dashboard, onboarding, and admin routes
- Tailwind CSS and Framer Motion
- Supabase browser client for auth, database access, and Edge Function calls

### Mobile Application

Location: `ratibu_mobile/`

- Flutter with Riverpod state management
- GoRouter navigation
- Supabase Flutter for auth and data access
- Firebase Messaging and local notifications for device alerts

### Backend

Location: `pesachama-backend/`

- Supabase Auth for user identity
- PostgreSQL for relational data
- Row Level Security for tenant-aware data access
- Storage buckets for branding and KYC artifacts
- Edge Functions for payment flows, OTP flows, callbacks, and automation

## Data and Flow Boundaries

### Auth and Onboarding

1. Users sign up in web or mobile.
2. OTP verification and KYC requirements gate access to core product screens.
3. Approved user records then participate in chama and payment workflows.

### Payments

1. Web or mobile initiates an Edge Function call to `trigger-stk-push`.
2. The backend validates the caller, writes a pending transaction, and contacts
   the Daraja API.
3. Safaricom calls `mpesa-callback`.
4. The callback finalizes the existing transaction as completed or failed.

### USSD

1. An external gateway posts user input to `ussd-handler`.
2. The handler reads membership and contribution context from Supabase.
3. Contribution flows delegate to the same payment function used by app clients.

## Integration Points

- Safaricom Daraja API for STK push, balance, QR, B2C, and transaction status
- USSD provider integration via a public Edge Function
- Firebase Messaging for mobile notifications
- Browser service worker and VAPID subscriptions for web push

## Operational Rules

- Public callbacks and gateway-facing functions must run with `verify_jwt =
  false` in Supabase config.
- User-triggered payment functions should validate the caller identity against
  the submitted `userId`.
- Payment callback handlers should be idempotent because provider retries are
  normal.
- Credentials belong in environment variables or Supabase secrets only.

## Improvement Priorities

- Keep app bootstrap logic separate from route definitions.
- Consolidate environment setup into examples and per-app READMEs.
- Expand automated tests around payments, onboarding, and callback handling.
- Archive or remove stale generated artifacts from the repo root and mobile app.
