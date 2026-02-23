# Hard Update - Quick Reference

## 📋 Files Created

| File | Purpose | Key Functions |
|------|---------|---|
| `Utility/versionUtils.ts` | Version comparison | `compareVersions()`, `needsForceUpdate()`, `hasOptionalUpdate()` |
| `service/updateService.ts` | Main service | `checkForUpdate()`, `getStoreUrl()` |
| `components/HardUpdateModal.tsx` | UI Component | Shows force/optional update modal |
| `app/AppNavigator.tsx` | Integration | Calls `checkForUpdate()` at startup |
| `doc/HARD_UPDATE_GUIDE.md` | Full documentation | Complete setup & troubleshooting |
| `doc/HARD_UPDATE_ARCHITECTURE.md` | Architecture diagrams | Visual flow & structure |

## 🚀 Quick Start

### 1. Firebase Remote Config Setup (5 minutes)
```
Firebase Console → Remote Config → Add Parameters:
  min_required_version    String    1.0.0
  latest_version          String    1.0.0
  force_update_enabled    Boolean   true
  update_message          String    "Update available"
→ Publish
```

### 2. Update iOS App Store ID (1 minute)
Edit `service/updateService.ts` line ~231:
```typescript
return 'https://apps.apple.com/app/id1234567890';  // Replace 1234567890
```

### 3. Test (3 minutes)
```bash
npm start
npm run ios  # or npm run android

# In Firebase Remote Config, set:
min_required_version: 999.0.0  # Forces update

# Expected: Red modal appears on app launch
```

## 🎯 Key Concepts

### Version Comparison
```
compareVersions('1.0.3', '1.0.4')  → -1  (older)
compareVersions('1.0.5', '1.0.4')  →  1  (newer)
compareVersions('1.0.0', '1.0.0')  →  0  (equal)
```

### Update Statuses
| Status | Meaning | Modal | Can Dismiss |
|--------|---------|-------|------------|
| `force` | Must update | Red | NO |
| `optional` | Should update | Blue | YES |
| `none` | App current | None | N/A |

### When Check Runs
- ✅ App startup (in `AppNavigator` useEffect)
- ✅ Before auth restore completes
- ✅ Blocks UI if force update needed
- ✅ Doesn't block if optional or none

## 🔧 Flow Command

The update check follows this logic:

```javascript
// 1. Get current app version from DeviceInfo
currentVersion = '1.0.1'

// 2. Get values from Firebase Remote Config
minRequired = '1.0.3'
latest = '1.1.0'
forceEnabled = true

// 3. Compare and determine status
if (currentVersion < minRequired) {
  status = 'force'  // Color: Red, Block: YES
} else if (currentVersion < latest && forceEnabled) {
  status = 'optional'  // Color: Blue, Block: NO
} else {
  status = 'none'  // No modal shown
}

// 4. Show appropriate modal
showModal(status)
```

## 💾 State Management

```typescript
hardUpdateState = {
  isVisible: boolean,          // Modal shown?
  isForceUpdate: boolean,      // Force vs optional?
  message: string,             // User message
  storeUrl: string             // iOS/Android store link
}
```

## 📊 Analytics Events

```
'HardUpdate_Available' {
  status: 'force' | 'optional',
  currentVersion: '1.0.1',
  newVersion: '1.1.0'
}

'HardUpdate_OpenStore' {
  platform: 'ios' | 'android'
}

'HardUpdate_SkipOptional' {}
```

## 🧪 Testing Checklist

- [ ] No internet → Uses cached Remote Config
- [ ] Force update → Red modal, cannot dismiss
- [ ] Optional update → Blue modal, can dismiss
- [ ] Up to date → No modal shown
- [ ] Store link opens → iOS App Store or Google Play
- [ ] Console logs appear → [UpdateService], [AppNavigator]

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Modal not showing | Check Remote Config values are published |
| Store won't open | Verify store URL format and Device Link support |
| Firebase errors | Check google-services.json / GoogleService-Info.plist |
| Version comparison wrong | Use semantic format: `X.Y.Z` not `X.Y` |
| Always using defaults | Check minimumFetchIntervalMillis setting |

## 📱 User Experience

**Force Update Flow:**
```
App opens → Red modal → User MUST tap "Update Now" 
→ App Store/Play Store opens → User updates 
→ Returns to app → New version → No modal
```

**Optional Update Flow:**
```
App opens → Blue modal → User can:
  • Tap "Update Now" → App Store → Update → Returns
  • Tap "Later" → Modal closes → Use app → Later show again
```

**Up to Date Flow:**
```
App opens → Skips check → No modal → App works normally
```

## 🔑 Key Files Quick Access

```typescript
// Check current version at runtime
import DeviceInfo from 'react-native-device-info';
const version = DeviceInfo.getVersion();  // e.g., "1.0.1"

// Get Remote Config value
import remoteConfig from '@react-native-firebase/remote-config';
const min = remoteConfig().getValue('min_required_version').asString();

// Compare versions
import { compareVersions } from 'Utility/versionUtils';
const isOlder = compareVersions('1.0.0', '1.0.1') < 0;  // true

// Start update check
import { checkForUpdate } from 'service/updateService';
const result = await checkForUpdate();

// Show modal based on result
hardUpdateState.isVisible = result.status !== 'none';
```

## 🎨 Customizing UI

Edit `components/HardUpdateModal.tsx`:

```typescript
// Change colors
backgroundColor: theme.colors.error  // or .primary

// Change icons
source='alert-circle'  // or 'cloud-download'

// Change text
'Update Required'  // or 'Update Available'
'Message here'     // from Remote Config

// Change buttons
label='Update Now'  // top button (always shown)
label='Later'       // bottom button (optional only)
```

## 🌐 Store Links Format

| Platform | URL Format |
|----------|-----------|
| iOS | `https://apps.apple.com/app/id{APP_ID}` |
| Android | `https://play.google.com/store/apps/details?id=com.tenantmanager` |

## 📚 Related Documentation

- Full guide: `doc/HARD_UPDATE_GUIDE.md`
- Setup steps: `doc/HARD_UPDATE_SETUP.md`
- Architecture: `doc/HARD_UPDATE_ARCHITECTURE.md`
- Firebase docs: https://firebase.google.com/docs/remote-config
- React Native Firebase: https://rnfirebase.io/remote-config/usage

## ✨ Features

✅ Semantic version comparison  
✅ Firebase Remote Config integration  
✅ Force update (blocking modal)  
✅ Optional update (dismissible modal)  
✅ Material Design 3 UI  
✅ iOS App Store + Android Play Store support  
✅ Analytics event tracking  
✅ Offline fallback  
✅ Comprehensive logging  
✅ Full TypeScript support  
✅ Works with password reset deep links  
