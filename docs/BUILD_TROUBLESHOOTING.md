# EAS Build Troubleshooting

## "Install dependencies" phase failed

If your iOS build fails with *"Unknown error. See logs of the Install dependencies build phase"*:

### 1. Check the full build logs

1. Go to [expo.dev](https://expo.dev) → your project → **Builds**
2. Open the failed build
3. Expand the **Install dependencies** phase
4. Scroll through the logs for the actual error (look for `[stderr]` or `Error:`)
5. For iOS, you can also download the full Xcode logs at the bottom of the build page

### 2. Clear cache and retry

```bash
eas build --platform ios --profile production --clear-cache
```

### 3. Ensure EAS secrets are set

Your app needs Supabase env vars. If they're missing, the build can fail:

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_URL" --scope project
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_KEY" --scope project
```

### 4. Verify locally

```bash
rm -rf node_modules
npm install
npx expo prebuild --clean
cd ios && pod install && cd ..
```

If `pod install` fails locally, it will fail on EAS too.

### 5. Common causes

| Cause | Fix |
|-------|-----|
| CocoaPods / react-native-maps conflict | Update `react-native-maps`: `npx expo install react-native-maps` |
| Node version mismatch | `eas.json` has `"node": "20.18.0"` in production profile |
| Corrupted cache | Run with `--clear-cache` |
| Lock file out of sync | Delete `node_modules` and `package-lock.json`, run `npm install`, commit the new lock file |
