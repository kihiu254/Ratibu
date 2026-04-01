# Ratibu Web

This is the React and Vite frontend for Ratibu. It contains the public
marketing pages, auth flows, member dashboard, onboarding and KYC screens, and
the admin area.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Supabase JavaScript client

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Environment Variables

Create `.env.local` from `.env.example`.

Required values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional values:

- `VITE_VAPID_PUBLIC_KEY` for browser push notifications

## Structure

- `src/routes/`: route composition
- `src/bootstrap/`: app startup side effects such as push notifications
- `src/pages/`: page-level screens
- `src/components/`: reusable UI pieces
- `src/layouts/`: shared layout shells
- `src/lib/`: shared clients and utilities

## Notes

- Browser notification setup is intentionally separated from route definitions.
- Route protection still lives in layout and page flow logic, so env variables
  must be configured before testing auth or notifications.
