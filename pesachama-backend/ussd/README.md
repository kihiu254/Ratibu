# USSD Sandbox

This folder is the local USSD research area for the Ratibu backend.

## What is here

- `test-ussd.ps1` runs a repeatable set of USSD requests against the deployed handler.
- `.env.example` lists the environment variables you can override for local testing.
- The handler is written to work with both the older `profiles.phone_number` shape and the newer `users.phone` shape, so it can survive the schema drift in this repo.

## Africa's Talking setup

1. If you are testing in the simulator, use the **sandbox** dashboard at `https://account.africastalking.com/apps/sandbox`.
2. If you are testing a live shared code like `*384*38070#`, use the **Service Codes** page in the live dashboard.
3. Point the callback URL to your deployed Supabase Edge Function:
   `https://<your-project-ref>.supabase.co/functions/v1/ussd-handler`
4. Use `POST` requests with form-encoded fields matching Africa's Talking's USSD payload:
   `sessionId`, `serviceCode`, `phoneNumber`, and `text`.
5. Make sure the function is deployed with `verify_jwt = false` so Africa's Talking can reach it.
6. Use the sandbox/production numbers and short code from your Africa's Talking account when you test.
7. If you see the simulator saying it reached Africa's Talking USSD Services, that usually means the sandbox channel is not set up yet or you are using the live service-code page instead of the sandbox simulator.
8. If your current Supabase branch uses `users` instead of `profiles`, the handler will still resolve the member by phone and show the same menus.

## Local research flow

1. Copy `.env.example` to `.env` if you want to keep your own values in one place.
2. Set `USSD_HANDLER_URL` to the function you want to hit.
3. Run `./test-ussd.ps1` from PowerShell.

## USSD Shape

The sandbox handler now starts with a transaction PIN prompt and then follows the app's own navigation model with short, keypad-friendly labels:

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

## Notes

- The handler now accepts common Kenya phone formats such as `07XXXXXXXX`, `01XXXXXXXX`, `2547XXXXXXXX`, and `+2547XXXXXXXX`.
- The handler blocks unregistered phone numbers before the menu, so only numbers already stored in Supabase can continue.
- The meeting lookup accepts both `meetings.date` and the older `meetings.scheduled_at` field.
- If your phone numbers are stored in a different format than the examples above, standardize them or extend the lookup variants in `ussd-handler/index.ts`.
- Africa's Talking USSD menus should stay short and avoid special characters, so the handler keeps the labels plain and keypad-friendly.
