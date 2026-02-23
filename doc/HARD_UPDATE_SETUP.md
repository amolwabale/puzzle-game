# Hard Update - Quick Setup Checklist

## ✅ Implementation Complete

All hard update code has been implemented and integrated. Here's what was created:

### Files Created:
- ✅ `Utility/versionUtils.ts` - Version comparison logic
- ✅ `service/updateService.ts` - Firebase Remote Config integration
- ✅ `components/HardUpdateModal.tsx` - Beautiful update modal UI
- ✅ Dependencies installed: `@react-native-firebase/remote-config`
- ✅ `app/AppNavigator.tsx` - Integration and startup check

### TypeScript:
- ✅ All files compile without errors
- ✅ Full type safety implemented
- ✅ Proper error handling throughout

## 🔧 Firebase Remote Config Setup (Required)

Before testing, configure Firebase Remote Config:

### Do This:
1. Open [Firebase Console](https://console.firebase.google.com)
2. Go to **Engage → Remote Config**
3. Add these 4 parameters:

```
Parameter Name                | Value Type | Example Value
------------------------------|-----------|----------------
min_required_version          | String    | 1.0.3
latest_version                | String    | 1.1.0
force_update_enabled          | Boolean   | true
update_message                | String    | New features available. Please update.
```

### Then Publish Changes!

## 📋 Pre-Testing Checklist

Before running app:

- [ ] Updated `service/updateService.ts` with your iOS App Store ID
- [ ] Verified Android package is `com.tenantmanager` (already correct)
- [ ] Configured Firebase Remote Config values (see above)
- [ ] Published Remote Config changes

## 🧪 Test Scenarios

### Test 1: App is Up to Date
```
Remote Config:
  min_required_version = 1.0.0
  latest_version = 1.0.0
  force_update_enabled = false

Result: No modal shown ✅
```

### Test 2: Optional Update Available
```
Remote Config:
  min_required_version = 1.0.0
  latest_version = 1.1.0
  force_update_enabled = true

Result: Blue modal with "Update Available" and "Later" button ✅
```

### Test 3: Force Update Required
```
Remote Config:
  min_required_version = 999.0.0
  latest_version = 999.0.0
  force_update_enabled = true

Result: Red modal with "Update Required", no "Later" button ✅
        User cannot dismiss or use app until update
```

## 🚀 Run App

```bash
# Terminal 1: Start Metro
npm start

# Terminal 2: Run on platform
npm run ios      # or npm run android

# Watch for these console logs:
# [UpdateService] Checking for hard update...
# [UpdateService] Current app version: KEY:...
# [UpdateService] Remote Config values: ...
# [AppNavigator] Update available: force (or none/optional)
```

## 🎯 Expected Behavior

### At App Launch

```
1. App initializes
   ↓
2. Authentication checked (restored session if exists)
   ↓
3. Hard update check triggered
   ↓
4. Firebase Remote Config fetched
   ↓
5. Version comparison
   ↓
   └─→ If force update needed: Show RED modal (blocking)
   └─→ If optional update: Show BLUE modal (dismissible)
   └─→ If up to date: Continue normally
```

## 📱 User Flow

### Scenario 1: Force Update Needed
```
User opens app
  ↓
Red "Update Required" modal appears
  ↓
User CAN ONLY:
  - Tap "Update Now" → Opens App Store/Play Store
  - Cannot dismiss (no back button, no swipe)
  - Cannot see app behind modal
```

### Scenario 2: Optional Update Available
```
User opens app
  ↓
Blue "Update Available" modal appears
  ↓
User CAN:
  - Tap "Update Now" → Opens App Store/Play Store
  - Tap "Later" → Modal dismisses, app continues normally
  - Can see app behind modal (semi-transparent)
```

### Scenario 3: App is Current
```
User opens app
  ↓
No modal
  ↓
App continues normally
  ✓ User can authenticate and use app normally
```

## 📊 Debugging

### Check Console for:

```
✅ [UpdateService] Starting update check...
✅ [UpdateService] Current app version: X.Y.Z
✅ [UpdateService] Remote Config fetched and activated
✅ [UpdateService] Extracted: {hasAccessToken: ..., hasRefreshToken: ..}
✅ [AppNavigator] Update available: force / optional / none
```

### If Something Wrong:

```
❌ [UpdateService] Error fetching Remote Config: ...
  → Check Firebase project ID in google-services.json
  → Check RemoteConfig not disabled
  → Check internet connection

❌ [HardUpdateModal] Cannot open store URL: ...
  → Verify store URL in updateService.ts
  → On iOS: Check Linking configuration
  → On Android: Verify Play Store app installed

❌ No version update message appearing
  → Set minimumFetchIntervalMillis to 0 in dev
  → Check Remote Config values are published
  → Check Remote Config values match version format
```

## 📝 Important Notes

1. **Version Format**: Must be semantic `X.Y.Z` (e.g., `1.0.3`)
   - `1.0.0` ✅
   - `1.0.1` ✅
   - `2.3.10` ✅
   - `1.0` ❌ (missing patch)
   - `v1.0.0` ❌ (has 'v' prefix)

2. **Remote Config Publishing**: Changes don't take effect until PUBLISHED
   - Edit values
   - Click "Publish changes"
   - Wait ~30 seconds for distribution
   - Then app will see new values

3. **Force Update is BLOCKING**: Cannot be dismissed
   - Modal covers entire screen
   - User must update or force quit app
   - Use carefully - can't harm user experience worse than bugs in old version

4. **Optional Update is Dismissible**: User can skip
   - Useful for gradual rollout
   - Users can update at their convenience
   - Prevent server errors from old app versions

5. **Offline Handling**: If no internet
   - Remote Config uses cached values
   - Falls back to defaults if never fetched
   - App continues to work

## 🔗Quick Links

- Full Guide: `doc/HARD_UPDATE_GUIDE.md`
- Firebase Console: https://console.firebase.google.com
- Remote Config: Navigate to Engage → Remote Config
- Version Utils: `Utility/versionUtils.ts`
- Update Service: `service/updateService.ts`
- Modal Component: `components/HardUpdateModal.tsx`

## ✨ Features Implemented

- ✅ Firebase Remote Config integration
- ✅ Semantic version comparison (1.0.3 vs 1.0.4)
- ✅ Force update modal (blocking, cannot dismiss)
- ✅ Optional update modal (dismissible)
- ✅ Beautiful Material Design 3 UI
- ✅ One-tap store opening (iOS App Store / Android Play Store)
- ✅ Comprehensive logging for debugging
- ✅ Analytics event tracking
- ✅ Offline fallback to defaults
- ✅ Full TypeScript support
- ✅ Integrates with existing Supabase auth flow
- ✅ Password reset deep links still work
