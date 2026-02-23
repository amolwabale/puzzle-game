# Hard Update Implementation Guide

## Overview

This document explains the hard update (forced update) system implemented in TenantManager app. This system uses Firebase Remote Config to control which app versions are allowed to use the app.

## 🎯 What is Hard Update?

**Hard Update (Force Update)** means:
- If current app version < minimum required version → User **MUST** update from store
- If current app version = latest version → App is up to date, no action needed
- If current app version < latest version → Optional update (can show message or skip)

## 🏗 Architecture

### Files Created

1. **`Utility/versionUtils.ts`** - Version comparison utilities
   - `compareVersions(v1, v2)` - Compare semantic versions
   - `needsForceUpdate()` - Check if force update required
   - `hasOptionalUpdate()` - Check if optional update available

2. **`service/updateService.ts`** - Hard update service
   - `checkForUpdate()` - Main function to check for updates at app start
   - Returns `UpdateCheckResult` with version info and messaging
   - Handles Firebase Remote Config initialization and fetch

3. **`components/HardUpdateModal.tsx`** - Beautiful blocking modal
   - Force update: Cannot dismiss, must update
   - Optional update: Can dismiss and continue
   - Material Design 3 themed
   - Opens app store when user taps "Update Now"

4. **`app/AppNavigator.tsx`** - Integration point
   - Added hard update check at app startup
   - Shows modal if update needed
   - Non-blocking for optional updates

## 🟢 Firebase Remote Config Setup

### Step 1: Go to Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your TenantManager project
3. Go to **Engage → Remote Config**

### Step 2: Add Configuration Parameters

Click **Add parameter** and add these 4 parameters:

| Parameter Name | Value Type | Default Value | Description |
|---|---|---|---|
| `min_required_version` | String | `1.0.0` | Minimum version user must have |
| `latest_version` | String | `1.0.0` | Latest available version |
| `force_update_enabled` | Boolean | `false` | Whether to force updates |
| `update_message` | String | `A new version is available...` | Custom message for users |

**Example values:**
```
min_required_version: 1.0.3
latest_version: 1.1.0
force_update_enabled: true
update_message: "New features and bug fixes are available. Please update to continue."
```

### Step 3: Publish Changes

Click **Publish** to make changes live.

## 📱 App Behavior

### At App Startup

1. ✅ App initializes (checks authentication)
2. ✅ Calls `checkForUpdate()` immediately after auth
3. Compares current version with Remote Config values
4. Shows appropriate modal if needed

### Version Check Logic

```
IF (currentVersion < minRequiredVersion)
  → FORCE UPDATE (cannot dismiss modal)
  → Block entire app
  
ELSE IF (currentVersion < latestVersion && forceUpdateEnabled)
  → OPTIONAL UPDATE (can dismiss modal)
  → Allow app to continue
  
ELSE
  → APP UP TO DATE
  → Continue normally
```

### Modal States

#### Force Update Modal (Blocking)
- ❌ Cannot dismiss
- ❌ No "Later" button
- ✅ "Update Now" button opens store
- Red icon and heading
- Message: "Update Required"

#### Optional Update Modal
- ✅ Can dismiss with "Later" button
- ✅ "Update Now" button opens store
- Blue icon and heading
- Message: "Update Available"

## 🔐 Store URLs

The system automatically opens the correct store based on platform:

**iOS:**
```
https://apps.apple.com/app/id{YOUR_APP_ID}
```
→ Update `service/updateService.ts` line with your App Store ID

**Android:**
```
https://play.google.com/store/apps/details?id=com.tenantmanager
```
→ Already configured for TenantManager

## 🧪 Testing Locally

### Option 1: Test with Remote Config (Real Firebase)

1. Set Firebase values to trigger update:
   ```
   min_required_version: 999.0.0  (forces update)
   latest_version: 999.0.0
   force_update_enabled: true
   update_message: "Testing hard update - please update TenantManager"
   ```

2. Build and run app:
   ```bash
   npm start
   npm run ios    # or npm run android
   ```

3. Watch for hard update modal on app start

4. Reset values after testing

### Option 2: Test with Mock (No Firebase)

To test without Firebase, temporarily modify `service/updateService.ts`:

```tsx
export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  // TEMPORARY: Force test
  return {
    status: 'force',  // or 'optional' or 'none'
    currentVersion: '1.0.0',
    minRequiredVersion: '1.5.0',
    latestVersion: '1.5.0',
    updateMessage: 'Force update test message',
    forceUpdateEnabled: true,
  };
};
```

### Option 3: Enable Development Logs

Open Metro console and filter for:
```
[UpdateService]
[VersionUtils]
[HardUpdateModal]
```

## 📊 Console Logs (Debugging)

When app starts, watch for these logs:

**Update Service:**
```
[UpdateService] Starting update check...
[UpdateService] Initializing Remote Config...
[UpdateService] Remote Config initialized with defaults
[UpdateService] Fetching Remote Config...
[UpdateService] Remote Config fetched and activated
[UpdateService] Current app version: 1.0.1
[UpdateService] Remote Config values: {minRequired: "1.0.3", latest: "1.1.0", ...}
[UpdateService] ⛔ Force update required!  (or ✅ App is up to date)
[UpdateService] Update check result: {...}
```

**App Navigator:**
[AppNavigator] Checking for hard update...
[AppNavigator] Update available: force  (or optimal)
[AppNavigator] App is up to date

**Hard Update Modal:**
```
[HardUpdateModal] Opening store: https://...
[HardUpdateModal] Dismissing optional update
```

## 🚀 Production Deployment

### Before Going Live

1. **Update App Store IDs:**
   - iOS: Replace `1234567890` with your App Store ID in `service/updateService.ts`
   - Android: Verify `com.tenantmanager` package ID is correct

2. **Set Minimum Fetch Interval:**
   - Development: 0ms (fetch immediately)
   - Production: 3600000ms (1 hour cache)
   - Currently uses: `__DEV__ ? 0 : 3600000`

3. **Configure Remote Config:**
   ```
   min_required_version: 1.0.0  (or your first live version)
   latest_version: 1.0.0
   force_update_enabled: true (or false initially)
   update_message: "Update Available"
   ```

4. **Test on TestFlight/Beta:**
   - Deploy app version 1.0.0 to TestFlight
   - Set Remote Config: min = 1.0.0, latest = 1.0.0
   - Verify no modal shows (app is current)
   - Then set min = 999.0.0
   - Verify modal shows force update

5. **Plan Update Strategy:**
   - When deploying new version to stores, don't update Remote Config yet
   - Let users download new version
   - Then update Remote Config to force old versions to update

### Version Numbers

Use semantic versioning: `MAJOR.MINOR.PATCH`

Examples:
- `1.0.0` - First release
- `1.0.1` - Bug fix
- `1.1.0` - New features
- `2.0.0` - Major breaking changes

## 🔗 Related Files

- Authentication: `app/AppNavigator.tsx` (where check is triggered)
- Analytics: Events logged via `service/analyticsTracker.ts`
- Navigation: Deep links still work even when update modal shown

## 🛠 Troubleshooting

### Modal Not Showing

**Problem:** Update modal not appearing when it should

**Solutions:**
1. Check Firebase Remote Config values are set correctly
2. Verify app is running on same Firebase project
3. Check console for `[UpdateService]` logs
4. Confirm `minimumFetchIntervalMillis` not too high in dev
5. Try clearing app data and restarting

### Store URL Not Opening

**Problem:** Clicking "Update Now" doesn't open store

**Solutions:**
1. Verify store URLs in `service/updateService.ts`
2. Check `Linking.canOpenURL()` returns true
3. On iOS: Ensure test device has App Store app
4. On Android: Ensure test device has Google Play Store app

### Version Comparison Wrong

**Problem:** Version comparison not working correctly

**Solutions:**
1. Verify version format is semantic: `X.Y.Z` (e.g., `1.0.3`)
2. Check `Utility/versionUtils.ts` has correct comparison logic
3. Test with simple examples: `1.0.0` vs `1.0.1`

### Remote Config Not Fetching

**Problem:** Using default values instead of Remote Config

**Solutions:**
1. Check Firebase project ID correct in `google-services.json` and `GoogleService-Info.plist`
2. Verify FirebaseCore and RemoteConfig properly initialized
3. Check internet connection (Remote Config needs network)
4. Look for errors in console: `[UpdateService] Error fetching Remote Config`

## 📈 Analytics Events

Hard update system logs these analytics events:

- `HardUpdate_Available` - Update check found update
  - `status`: 'force' or 'optional'
  - `currentVersion`: Current app version
  - `newVersion`: Latest available version

- `HardUpdate_OpenStore` - User clicked "Update Now"
  - `platform`: 'ios' or 'android'

- `HardUpdate_SkipOptional` - User skipped optional update
  - (logged when "Later" clicked)

Track these in Firebase Analytics dashboard to see:
- How many users encounter forced updates
- Conversion rate for opening store
- When most users skip optional updates

## 🎓 How to Use

### For QA/Testing

1. Ask product team to provide test version numbers
2. Set those in Firebase Remote Config
3. Run app and verify correct modal shows
4. Test both force and optional update scenarios
5. Verify app store opens correctly on tap

### For Product Team

1. Decide minimum required version before releasing new app version
2. Release app to stores
3. Wait for user adoption
4. Update Remote Config to required version when ready to force update
5. Monitor analytics to see update rate

### For Developers

1. When releasing new version:
   - Update app version in `app.json` and `android/app/build.gradle`
   - Deploy to stores
   - Update Remote Config `latest_version` (optional)

2. When forcing users to update:
   - Update Remote Config `min_required_version`
   - Publish changes
   - Monitor adoption via Firebase Analytics

## 📚 References

- [Firebase Remote Config Docs](https://firebase.google.com/docs/remote-config)
- [React Native Firebase Remote Config](https://rnfirebase.io/remote-config/usage)
- [React Native Device Info](https://github.com/react-native-device-info/react-native-device-info)
- [Semantic Versioning](https://semver.org/)

## 🤝 Support

For issues or questions about hard update implementation:

1. Check console logs for error messages
2. Review this guide's Troubleshooting section
3. Check Firebase Remote Config values
4. Verify store URLs are correct for your app
