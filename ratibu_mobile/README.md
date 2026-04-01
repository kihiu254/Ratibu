# Ratibu Mobile

This is the Flutter client for Ratibu. It includes authentication, onboarding,
OTP verification, KYC submission, dashboard access, chama flows, payments,
notifications, and profile management.

## Stack

- Flutter 3.x
- Riverpod
- GoRouter
- Supabase Flutter
- Firebase Messaging
- flutter_local_notifications

## Run Locally

```bash
flutter pub get
flutter run
```

## Important Files

- `lib/main.dart`: app bootstrap, routing, theme, and notification setup
- `lib/providers/`: auth, profile, chama, and home state
- `lib/services/`: M-Pesa, security, user, and transaction logic
- `lib/screens/`: product screens and onboarding flows

## Setup Notes

- Update the Supabase configuration before running auth flows.
- Configure Firebase per platform before testing push notifications.
- Generated analysis logs should not be committed; use `flutter analyze`
  locally instead of storing analyzer output files in the repo.
