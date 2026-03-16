# Supabase Email Templates (Ratibu)

Custom Supabase Auth email templates that match the Ratibu UI. Colors and typography align with the web app (primary #00C853, security accent #B91C1C, font fallback to Outfit/Inter).

## How to use

1. Open Supabase Dashboard.
2. Go to Authentication -> Email Templates.
3. Select the template type.
4. Paste the HTML from the matching file in this folder.
5. Update links like `{{ .SiteURL }}/settings/security` if your app uses a different path.

## Authentication templates

- `auth-confirm-signup.html` (Confirm sign up)
  Uses: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .SiteURL }}`
- `auth-invite-user.html` (Invite user)
  Uses: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .SiteURL }}`
- `auth-magic-link.html` (Magic link)
  Uses: `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .SiteURL }}`
- `auth-change-email.html` (Change email address)
  Uses: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}`
- `auth-reset-password.html` (Reset password)
  Uses: `{{ .RecoveryURL }}`, `{{ .Email }}`, `{{ .SiteURL }}`
- `auth-reauthentication.html` (Reauthentication)
  Uses: `{{ .Token }}`, `{{ .SiteURL }}`

## Security templates

- `security-password-changed.html` (Password changed)
  Uses: `{{ .Email }}`, `{{ .SiteURL }}`
- `security-email-changed.html` (Email changed)
  Uses: `{{ .OldEmail }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}`
- `security-phone-changed.html` (Phone changed)
  Uses: `{{ .OldPhone }}`, `{{ .Phone }}`, `{{ .SiteURL }}`
- `security-identity-linked.html` (Identity linked)
  Uses: `{{ .Provider }}`, `{{ .Email }}`, `{{ .SiteURL }}`
- `security-identity-unlinked.html` (Identity unlinked)
  Uses: `{{ .Provider }}`, `{{ .SiteURL }}`
- `security-mfa-added.html` (MFA added)
  Uses: `{{ .FactorType }}`, `{{ .SiteURL }}`
- `security-mfa-removed.html` (MFA removed)
  Uses: `{{ .FactorType }}`, `{{ .SiteURL }}`

## Notes

- All templates use `{{ .SiteURL }}` for the footer and security button. Make sure the Site URL is set correctly in Supabase Auth settings.
- The header logo uses `{{ .SiteURL }}/ratibu-logo.png`. Ensure the file is publicly hosted at your app domain (for example `https://chama.ratibuneobank.com/ratibu-logo.png` or `https://ratibu.vercel.app/ratibu-logo.png`).
- The security button uses `{{ .SiteURL }}/settings/security` as a default path. Update it if your app uses a different route.
- The Magic Link and Reauthentication templates display `{{ .Token }}` as a one-time code for OTP flows.
