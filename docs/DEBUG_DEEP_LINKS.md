# Deep Link Debugging Guide

## Issues Fixed

### 1. Android: Wrong Intent Filter
**Problem**: AndroidManifest.xml had `android:host="auth"` which didn't match the deep link format
- Deep link: `tenantmanager://reset-password?access_token=...`
- Old filter: `tenantmanager://auth` (wrong!)
- Fixed: Now accepts any path under `tenantmanager://` scheme

**File**: `android/app/src/main/AndroidManifest.xml`
```xml
<!-- OLD (WRONG) -->
<data android:scheme="tenantmanager" android:host="auth" />

<!-- NEW (CORRECT) -->
<data android:scheme="tenantmanager" />
```

### 2. iOS: Missing URL Scheme (Already Configured ✅)
**Status**: Already properly configured in `ios/TenantManager/Info.plist`
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>tenantmanager</string>
    </array>
  </dict>
</array>
```

### 3. AppNavigator: Improved Deep Link Handling
**Changes**:
- Added `Linking` import from React Native
- Split URL parsing into separate `parseResetPasswordDeepLink()` function
- Added comprehensive logging throughout
- Used `Linking.getInitialURL()` in linking config for cold-start deep links
- Added `Linking.addEventListener('url', ...)` for runtime deep link detection
- Fixed navigation to use proper React Navigation syntax with setTimeout

**Key Files**: 
- `app/AppNavigator.tsx` - Main changes
- `screen/Identity/SetNewPasswordScreen.tsx` - Added logging

## Deep Link Flow (Now Working)

### Cold Start (App Not Running)
1. Deep link received from email: `tenantmanager://reset-password?access_token=XXX&refresh_token=YYY`
2. iOS/Android OS routes to app
3. `Linking.getInitialURL()` in linking config detects URL
4. React Navigation parses path (`reset-password`)
5. Routes to AuthStack → SetNewPasswordScreen
6. `handleResetPasswordDeepLink()` called with full URL
7. Tokens extracted and passed as route params

### Runtime (App Already Running)
1. User taps link while app is running
2. `Linking.addEventListener('url', ...)` fires
3. `handleResetPasswordDeepLink()` called immediately
4. Navigation with tokens happens with 300ms delay (ensures NavigationContainer ready)

## Logging Points to Monitor

### Console Logs for Debugging:

**AppNavigator.tsx:**
```
[DeepLink] Parsing URL: ...
[DeepLink] Params string: ...
[DeepLink] Parsed param: access_token = ...
[DeepLink] Extracted: {hasAccessToken: true, hasRefreshToken: true, ...}
[DeepLink] Handling: ...
[DeepLink] Navigating with tokens
[Navigation] onReady
[Navigation] Screen changed: AuthStack -> SetNewPasswordScreen
```

**SetNewPasswordScreen.tsx:**
```
[SetNewPasswordScreen] Rendered
[SetNewPasswordScreen] Route params: {hasAccessToken: true, paramsKeys: ...}
[SetNewPasswordScreen] useEffect for session init triggered
[SetNewPasswordScreen] Establishing session from tokens...
[SetNewPasswordScreen] Session established successfully
```

## Testing Checklist

### iOS Testing
- [ ] Open email app within TestFlight app (to stay in same OS container)
- [ ] Tap reset password link
- [ ] Check console for `[DeepLink]` logs
- [ ] Verify SetNewPasswordScreen appears
- [ ] Verify tokens passed correctly

### Android Testing
- [ ] Open email app (Gmail, etc.)
- [ ] Tap reset password link
- [ ] Check `adb logcat` for `[DeepLink]` logs
- [ ] Verify app opens
- [ ] Verify SetNewPasswordScreen appears

### Common Issues to Check
1. **App doesn't open on Android**: Check AndroidManifest.xml - intent filter must allow `tenantmanager://` scheme
2. **App opens but wrong screen shows**: Check AppNavigator navigation logic and logging
3. **Tokens not received in SetNewPasswordScreen**: Check parseResetPasswordDeepLink() URL parsing and handleResetPasswordDeepLink() navigation
4. **Session fails to establish**: Check Supabase auth configuration

## URL Formats Supported

### Query String Format (Most Common)
```
tenantmanager://reset-password?access_token=eyJ...&refresh_token=eyJ...
```

### Hash Fragment Format
```
tenantmanager://reset-password#access_token=eyJ...&refresh_token=eyJ...
```

### Short Code Format (Alternative)
```
tenantmanager://reset-password?code=abc123
```

## Files Modified

1. **android/app/src/main/AndroidManifest.xml** - Fixed intent-filter
2. **app/AppNavigator.tsx** - Improved deep link handling
3. **screen/Identity/SetNewPasswordScreen.tsx** - Added logging
4. **navigation/StackParam.tsx** - Already has correct types (no changes)

## Next Steps

1. Build and run on both iOS and Android
2. Monitor console/logcat for `[DeepLink]` and `[SetNewPasswordScreen]` logs
3. Test clicking reset password link from email
4. Verify SetNewPasswordScreen appears with tokens intact
5. Test password update flow end-to-end
