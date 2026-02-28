# Creating Your App in App Store Connect (for ascAppId)

You need to create the app in **App Store Connect** to get your `ascAppId`. This is separate from the Developer Portal and does **not** involve App ID capabilities.

## You Don't Need to Configure Capabilities

**App Store Connect** = Where you create the app listing for distribution. No capabilities here.

**Apple Developer Portal** (Identifiers → App IDs) = Where capabilities live. **EAS Build handles this for you** when you run your first build. You do not need to create an App ID manually.

## Steps to Create the App (and get ascAppId)

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) and sign in with `brandonvu10@gmail.com`.

2. Click **My Apps** → **+** (or "Add App") → **New App**.

3. Fill in the form:
   - **Platforms**: iOS
   - **Name**: Versus
   - **Primary Language**: English (or your choice)
   - **Bundle ID**: Select **com.vufoo.versus** from the dropdown  
     - If it doesn't appear, EAS will create it when you run your first build. Run `eas build --platform ios --profile production` first, then come back and create the app.
   - **SKU**: Any unique string (e.g. `versus-1` or `com.vufoo.versus`)
   - **User Access**: Full Access (default)

4. Click **Create**.

5. To get your **ascAppId**:
   - Open your new app
   - In the left sidebar, under **General**, click **App Information**
   - Find **Apple ID** (a numeric value like `1234567890`)
   - That number is your `ascAppId`

6. Add it to `eas.json`:
   ```json
   "submit": {
     "production": {
       "ios": {
         "appleId": "brandonvu10@gmail.com",
         "appleTeamId": "29MSN8SHT4",
         "ascAppId": "YOUR_NUMERIC_APPLE_ID_HERE"
       }
     }
   }
   ```

## If Bundle ID Doesn't Appear

The bundle ID `com.vufoo.versus` must exist in your Apple Developer account before it shows in App Store Connect. EAS Build creates it automatically when you run:

```bash
eas build --platform ios --profile production
```

So you can either:
- **Option A**: Run a build first, then create the app in App Store Connect
- **Option B**: Manually create an App ID in [Developer Portal → Identifiers](https://developer.apple.com/account/resources/identifiers/list) with bundle ID `com.vufoo.versus` and no extra capabilities (EAS will add what it needs)

For Expo/React Native apps, **Option A** is usually easier — let EAS do the work.
