# Versus – Deployment Guide (TestFlight & App Store)

This guide walks you through deploying Versus to TestFlight and the Apple App Store. Most infrastructure is already configured; you mainly need an Apple Developer account and to run a few commands.

---

## What’s Already Set Up

- **EAS Build** – `eas.json` with development, preview, and production profiles
- **App config** – `app.config.js` with bundle ID `com.vufoo.versus`, iOS/Android settings
- **Build scripts** – `npm run build:ios`, `npm run submit:ios`, etc.
- **Runtime version** – For future OTA updates via EAS Update

---

## Step 1: Get an Apple Developer Account ($99/year)

You need an Apple Developer Program membership to use TestFlight and the App Store.

### Option A: Enroll on the web

1. Go to [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll)
2. Sign in with your Apple ID (or create one)
3. Choose **Individual** or **Organization**
   - **Individual**: Apple ID, 2FA, legal name, address
   - **Organization**: D-U-N-S number, legal authority, company website
4. Pay **$99 USD** (or local equivalent)
5. Wait for approval (often 24–48 hours)

### Option B: Enroll via the Apple Developer app

1. Install the **Apple Developer** app on iPhone, iPad, or Mac
2. Open it and follow the enrollment flow
3. Complete payment and verification

### After enrollment

- You’ll get access to [App Store Connect](https://appstoreconnect.apple.com/) and [Apple Developer Portal](https://developer.apple.com/account/)
- TestFlight is included (up to 10,000 external testers)

---

## Step 2: Install EAS CLI and Log In

```bash
npm install -g eas-cli
eas login
```

Create an Expo account at [expo.dev/signup](https://expo.dev/signup) if needed.

---

## Step 3: Configure EAS Project (First Time Only)

```bash
eas build:configure
```

This links the project to your Expo account. If prompted, choose to use the existing `eas.json`.

---

## Step 4: Add Environment Variables for Production Builds

Your app uses Supabase. Add these as EAS secrets so production builds work:

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_SUPABASE_URL" --scope project
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_SUPABASE_ANON_KEY" --scope project
```

Replace with your real Supabase URL and anon key from the Supabase dashboard.

---

## Step 5: Create the App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. **My Apps** → **+** → **New App**
3. Fill in:
   - **Platforms**: iOS
   - **Name**: Versus
   - **Primary Language**: English (or your choice)
   - **Bundle ID**: `com.vufoo.versus` (must match `app.config.js`)
   - **SKU**: e.g. `versus-1`
4. Create the app.

### Get the App Store Connect App ID (ascAppId)

1. Open your app in App Store Connect
2. Go to **App Information** (under General in the left sidebar)
3. Copy the **Apple ID** (numeric, e.g. `1234567890`) — this is your `ascAppId`
4. Add it to `eas.json` under `submit.production.ios.ascAppId`

---

## Step 6: Build for Production

```bash
npm run build:ios
# or: eas build --platform ios --profile production
```

On first run, EAS will ask about credentials. Choose **Let EAS handle it** so it can create and manage signing.

When the build finishes, EAS will give you a build URL and an `.ipa` file.

---

## Step 7: Submit to TestFlight

After a successful build:

```bash
npm run submit:ios
# or: eas submit --platform ios --profile production
```

You’ll be prompted to:

1. Pick the build to submit
2. Sign in with your Apple ID
3. Optionally use an App Store Connect API key for automation

### Optional: Pre-fill submit config

If you want to avoid prompts when submitting, add a `submit` section to `eas.json`:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-apple-id@email.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABCD1234"
    }
  }
}
```

**Where to find each value:**

| Field | Where to find it |
|-------|------------------|
| **appleId** | The Apple ID email you use to sign into [App Store Connect](https://appstoreconnect.apple.com/) (e.g. `you@email.com`) |
| **ascAppId** | App Store Connect → Your app → **App Information** (under General) → **Apple ID** (numeric, e.g. `1234567890`) |
| **appleTeamId** | [developer.apple.com/account](https://developer.apple.com/account) → **Membership** → **Team ID** (e.g. `ABCD1234`) |

---

## Step 8: TestFlight Setup

1. In App Store Connect, open your app → **TestFlight**
2. Wait for the build to finish processing (often 10–20 minutes)
3. Add **Internal Testers** (up to 100, same team)
4. Add **External Testers** (up to 10,000) – requires a short Beta App Review
5. Testers install the **TestFlight** app and accept your invite

---

## Quick Reference

| Task              | Command                          |
|-------------------|-----------------------------------|
| Build iOS         | `npm run build:ios`               |
| Submit to TestFlight | `npm run submit:ios`           |
| Build + submit    | `eas build --platform ios --profile production --auto-submit` |
| List builds       | `eas build:list`                  |
| Check credentials | `eas credentials --platform ios`  |

---

## Troubleshooting

- **“No valid signing certificate”** – Run `eas credentials --platform ios` and let EAS create credentials
- **“Bundle ID mismatch”** – Ensure `com.vufoo.versus` in `app.config.js` matches App Store Connect
- **Build fails on env vars** – Confirm `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set in EAS secrets
- **Submit fails** – Confirm the app exists in App Store Connect and `ascAppId` is correct

---

## Before You Have an Apple Developer Account

You can still:

- Run **simulator builds**: `eas build --platform ios --profile development` (no Apple account)
- Run **preview builds** for internal testing (requires Apple account)
- Develop locally with `expo start` and Expo Go

Production builds and TestFlight require an active Apple Developer Program membership.
