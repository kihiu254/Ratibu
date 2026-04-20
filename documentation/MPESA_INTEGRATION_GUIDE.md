# Ratibu: M-Pesa Integration Guide (Going Live)

This guide outlines the steps to move from the sandbox environment to a live
M-Pesa production environment.

## 1. Prerequisites (Daraja Portal)

1. **Create a Developer Account:**
   - Visit [Safaricom Daraja Portal](https://developer.safaricom.co.ke/).
   - Sign up/Login.
2. **Create a New App:**
   - Go to **My Apps** -> **Create New App**.
   - Select `Lipa na M-Pesa Sandbox` (for testing) or
     `Lipa na M-Pesa Production` (for live).
   - Note down your **Consumer Key** and **Consumer Secret**.
3. **Get STK Push Credentials (Sandbox):**
   - **Business Shortcode:** `174379` (Default Sandbox Paybill).
   - **Passkey:**
     `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`.

## 2. Going Live (Production)

To move to production, you need a vigorous verification process:

1. **Apply for a Paybill/Till Number:**
   - Visit a Safaricom shop or apply online at
     [Safaricom Business](https://www.safaricom.co.ke/business/).
   - You will receive a **business shortcode** (e.g., 500123) and a **Head
     Office number**.
2. **Go Live on Daraja:**
   - In the Daraja Portal, click **Go Live**.
   - Upload the verification documents required by Safaricom.
   - Once approved, you will get a **Production Consumer Key** and **Secret**.
   - You will also receive a **Passkey** via email.

## 3. Configuring Supabase Edge Functions

You need to update your backend environment variables to use the real
credentials.

**1. Set Secrets in Supabase:**

Run the following commands in your terminal (or set them in the Supabase
Dashboard under Settings > Edge Functions > Secrets):

```bash
# Sandbox Credentials
supabase secrets set MPESA_CONSUMER_KEY="your-consumer-key"
supabase secrets set MPESA_CONSUMER_SECRET="your-consumer-secret"
supabase secrets set MPESA_PASSKEY="your-passkey"
supabase secrets set MPESA_BUSINESS_SHORTCODE="your-shortcode"
supabase secrets set MPESA_ENV="sandbox"
# B2C / Withdrawal Credentials
supabase secrets set MPESA_INITIATOR_PASSWORD="your-initiator-password"
supabase secrets set MPESA_SECURITY_CREDENTIAL="your-security-credential"
```

**2. Update `trigger-stk-push` Function:**

Ensure your Edge Function constructs the password correctly:

```typescript
// Password generation formula
const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
const password = btoa(`${shortCode}${passkey}${timestamp}`);
```

## 4. Mobile App Updates

The mobile app typically doesn't need code changes if it calls the backend via
the generic `initiateStkPush` function. The backend handles the switch between
sandbox and production credentials.

**Key Checks:**

- **Phone Number Formatting:** Ensure the app sends phone numbers in the format
  `2547XXXXXXXX`.
- **Error Handling:** Handle cases where the user cancels the STK prompts
  (callback will be received by backend, app needs to poll or listen to realtime
  updates).

## 5. Handling Callbacks (Realtime Payment Status)

The current implementation triggers the push. To update the UI when payment
completes:

1. **Backend:** The `mpesa-callback` function receives the result from
   Safaricom.
2. **Database:** It updates the `transactions` table status to `completed` or
   `failed`.
3. **Mobile App:**
   - Use `Supabase.instance.client.from('transactions').stream(...)` to listen
     for updates to the specific transaction.
   - Show a success animation when the status changes to `completed`.

## 6. Daraja Rails Used in Ratibu

Ratibu now separates the rails by use case:

- **STK Push**: customer-initiated deposits and bill payments
- **B2C**: payouts and withdrawals to a phone number
- **C2B**: customer-to-business collections with registered validation and confirmation URLs
- **B2B Express Checkout**: merchant-initiated push-to-till payment flow

### New Edge Functions

- `c2b-register-url`
  - Registers the C2B validation and confirmation URLs against a Daraja shortcode.
- `c2b-validation`
  - Receives validation callbacks and accepts or rejects a payment.
- `c2b-confirmation`
  - Receives confirmation callbacks and records completed collections.
- `b2b-express-checkout`
  - Initiates the merchant push-to-till flow from the app/backend.

### Callback URLs

- `status-callback`
  - Used for B2B express checkout callbacks and other generic transaction status updates.
- `b2c-callback`
  - Used for B2C payout callbacks.
- `mpesa-callback`
  - Used for STK push callbacks.

### Required Secrets

- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_BUSINESS_SHORTCODE`
- `MPESA_B2C_SHORTCODE`
- `MPESA_INITIATOR_NAME`
- `MPESA_SECURITY_CREDENTIAL`
- `MPESA_ENV`
- `MPESA_C2B_SHORTCODE` if you want C2B to validate against a specific shortcode

---

## Troubleshooting

- **Invalid Access Token:** Check if Consumer Key/Secret are correct.
- **Request Cancelled:** User denied the STK prompt.
- **DS timeout:** M-Pesa system is slow/down.
