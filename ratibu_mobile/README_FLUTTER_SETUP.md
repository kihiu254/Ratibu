# Flutter Project Setup Guide

Due to a "Device Guard" policy restriction on your machine, I was unable to run
`flutter create` directly. However, I have manually created the source code for
your mobile app.

Please follow these steps to finish setting up the project:

## Step 1: Initialize the Project

Open your terminal (PowerShell or CMD) in this directory (`ratibu_mobile`) and
run:

```bash
flutter create .
```

_Note: The `.` tells Flutter to create the project in the _current_ directory.
It should respect the existing `lib` and `pubspec.yaml` files, but if it asks to
overwrite, you can say **no** to `lib/main.dart` if you want to keep my code, or
backup `lib` first._

**Better Approach if Overwrite is Forced:**

1. Rename the current `lib` folder to `lib_backup`.
2. Run `flutter create .`
3. Delete the specific `lib/main.dart` created by Flutter.
4. Move the files from `lib_backup` into `lib`.
5. Ensure `pubspec.yaml` includes the dependencies listed in
   `pubspec_backup.yaml` (if I created one) or just add them:
   ```yaml
   dependencies:
       flutter:
           sdk: flutter
       supabase_flutter: ^1.10.0
       flutter_riverpod: ^2.4.0
       go_router: ^12.0.0
       google_fonts: ^6.1.0
   ```

## Step 2: Install Dependencies

Once the project is initialized, run:

```bash
flutter pub get
```

## Step 3: Configure Supabase

Open `lib/config/supabase_config.dart` and replace the placeholder values with
your actual Supabase URL and Anon Key from your Supabase Dashboard.

```dart
static const String supabaseUrl = 'YOUR_SUPABASE_URL';
static const String supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
```

## Step 4: Run the App

Connect your device or start an emulator, then run:

```bash
flutter run
```
