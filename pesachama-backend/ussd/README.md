# USSD Sandbox

This folder is the local USSD research area for the Ratibu backend.

## What is here

- `test-ussd.ps1` runs a repeatable set of USSD requests against the deployed handler.
- `.env.example` lists the environment variables you can override for local testing.
- The handler works with both the older `profiles.phone_number` shape and the newer `users.phone` shape, so it can survive the schema drift in this repo.

## Gateway setup

1. If you are testing in the MSpace environment, use the MSpace USSD dashboard and service-code setup.
2. If you are testing in an Africa's Talking environment, use its sandbox or live service-code setup.
3. Register the client service code, then the gateway will call your callback through its USSD route.
4. Point the callback URL to your deployed Supabase Edge Function:
   `https://<your-project-ref>.supabase.co/functions/v1/ussd-handler`
5. Use `POST` requests with form-encoded fields matching the gateway payload:
   `SESSION_ID`, `SERVICE_CODE`, `MSISDN`, `USSD_STRING`, or the equivalent `sessionId`, `serviceCode`, `phoneNumber`, and `text`.
6. Make sure the function is deployed with `verify_jwt = false` so the gateway can reach it.
7. Use the service code assigned to your account when you test.
8. If you see the phone showing a carrier-style popup instead of a Ratibu menu, the shortcode is still landing in the wrong USSD route.
9. If your current Supabase branch uses `users` instead of `profiles`, the handler will still resolve the member by phone and show the same menus.

## Local research flow

1. Copy `.env.example` to `.env` if you want to keep your own values in one place.
2. Set `USSD_HANDLER_URL` to the function you want to hit.
3. Run `./test-ussd.ps1` from PowerShell.

## USSD Shape

The sandbox handler starts with a transaction PIN prompt and then follows the app's own navigation model with short, keypad-friendly labels:

- `1` Dashboard
- `2` Chamas
- `3` Accounts
- `4` Savings
- `5` Meetings
- `6` Swaps
- `7` Profile
- `8` Rewards
- `9` Create Chama

Inside those menus, the options point users to the same concepts already in the app, but the wording is kept short so it feels natural on USSD.

USSD transaction shortcuts:

- `Accounts -> Chama Deposit` sends an STK push for your first active chama.
- `Accounts -> Chama Withdrawal` submits a withdrawal request.
- `Accounts -> Savings Deposit` updates your first active savings target.
- `Accounts -> Savings Withdrawal` reduces the same savings target after balance checks.
- `Savings -> Deposit` and `Savings -> Withdraw` mirror the same savings target flow.

Security notes:

- The handler rejects direct requests unless they come from a trusted gateway user agent or carry a recognizable USSD callback payload, unless `USSD_ALLOW_UNTRUSTED_REQUESTS=true` is set for local testing.
- MSpace callbacks are accepted when they carry a normal USSD payload shape such as `MSISDN`, `SESSION_ID`, and `USSD_STRING`.
- Africa's Talking callbacks are accepted when they carry its standard `phoneNumber`, `sessionId`, `serviceCode`, and `text` fields.
- If either gateway uses a custom user agent in your environment, you can add it to the handler's trust check without changing the menu logic.
- Repeated USSD payloads for the same session are replayed from the request log to avoid duplicate deposits.
- Savings transactions are processed through a database function so the balance update and transaction insert stay in sync.

## Notes

- The handler accepts common Kenya phone formats such as `07XXXXXXXX`, `01XXXXXXXX`, `2547XXXXXXXX`, and `+2547XXXXXXXX`.
- The handler blocks unregistered phone numbers before the menu, so only numbers already stored in Supabase can continue.
- The meeting lookup accepts both `meetings.date` and the older `meetings.scheduled_at` field.
- If your phone numbers are stored in a different format than the examples above, standardize them or extend the lookup variants in `ussd-handler/index.ts`.
- USSD menus should stay short and avoid special characters, so the handler keeps the labels plain and keypad-friendly.
