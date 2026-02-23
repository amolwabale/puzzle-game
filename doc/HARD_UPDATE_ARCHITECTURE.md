# Hard Update - System Architecture & Flow Diagrams

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     App Lifecycle                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  App.tsx (Start) │
                    └──────────────────┘
                              │
                              ▼
                   ┌────────────────────────┐
                   │   AppNavigator.tsx     │
                   │ - Auth check           │
                   │ - Session restore      │
                   └────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
         ┌────────────────────┐  ┌──────────────────────┐
         │  checkForUpdate()  │  │  Deep Links Listener │
         │  (Hard Update)     │  │  (Password Reset)    │
         └────────────────────┘  └──────────────────────┘
                    │
        ┌───────────┼────────────┐
        │           │            │
        ▼           ▼            ▼
    ┌─Force─┐  ┌─Optional─┐  ┌─None─┐
    │Update │  │Update    │  │Up to │
    │Needed │  │Available │  │date  │
    └───┬───┘  └────┬─────┘  └──┬──┘
        │           │            │
        ▼           ▼            ▼
    ┌─────────────────────────────────────┐
    │  Show HardUpdateModal (or not)      │
    │  - Force: Red, blocking, no dismiss │
    │  - Optional: Blue, dismissible      │
    │  - None: Hidden                     │
    └─────────────────────────────────────┘
        │           │            │
        ▼           ▼            ▼
    ┌─────────────┐ ┌──────────┐ ┌──────────────┐
    │User blocked │ │User can  │ │App continues │
    │Must update  │ │choose    │ │normally      │
    └─────────────┘ └──────────┘ └──────────────┘
```

## 📊 Version Comparison Flow

```
                    ┌─────────────────────────┐
                    │ Current App Version     │
                    │ (from DeviceInfo)       │
                    └───────────┬─────────────┘
                                │
                    ┌───────────┴──────────────┐
                    │                          │
                    ▼                          ▼
        ┌──────────────────────────┐  ┌───────────────────────┐
        │ Min Required Version from │  │ Latest Version from   │
        │ Firebase Remote Config    │  │ Firebase Remote Config│
        └─────────┬────────────────┘  └───────────┬───────────┘
                  │                               │
        ┌─────────▼──────────────┐               │
        │ Compare Versions       │               │
        │ (compareVersions fn)   │               │
        └─────────┬──────────────┘               │
                  │                               │
        ┌─────────▼──────────────────────────────┴─────┐
        │                                               │
    Current < Min?                          Current < Latest?
        │                                         │
       YES                                       YES
        │                                         │
        ▼                                         ▼
    ┌──────────────────┐                ┌────────────────────┐
    │ FORCE UPDATE     │                │ Check force_update │
    │ (status: force)  │                │ enabled flag       │
    └──────────────────┘                └────────┬───────────┘
                                                 │
                                    ┌────────────┴────────────┐
                                   YES                        NO
                                    │                         │
                                    ▼                         ▼
                            ┌──────────────────┐   ┌──────────────────┐
                            │ OPTIONAL UPDATE  │   │ UP TO DATE       │
                            │ (status: opt)    │   │ (status: none)   │
                            └──────────────────┘   └──────────────────┘
```

## 🔄 App Startup Sequence

```
App Launches
    │
    ├─► Initialize Navigation
    │   └─► PaperProvider (Theme)
    │
    ├─► App.tsx mounts
    │   └─► AppNavigator renders
    │
    ├─► useEffect Hook Triggers
    │   │
    │   ├─► Get Supabase Session
    │   │   └─► setSession()
    │   │   └─► Track analytics
    │   │   └─► Set Crashlytics user
    │   │
    │   ├─► Check for Hard Update ◄──── NEW
    │   │   │
    │   │   ├─► Initialize Remote Config
    │   │   │   └─► Set defaults
    │   │   │   └─► Set cache settings
    │   │   │
    │   │   ├─► Fetch Latest Config
    │   │   │   └─► Network call (async)
    │   │   │   └─► Activate remote values
    │   │   │
    │   │   ├─► Get Current App Version
    │   │   │   └─► DeviceInfo.getVersion()
    │   │   │
    │   │   ├─► Compare Versions
    │   │   │   └─► compareVersions()
    │   │   │
    │   │   ├─► Determine Status
    │   │   │   ├─► force / optional / none
    │   │   │   └─► Get update message
    │   │   │
    │   │   └─► Set Hard Update State
    │   │       └─► HardUpdateModal receives props
    │   │
    │   ├─► Start Deep Link Listener
    │   │   └─► Linking.addEventListener()
    │   │
    │   └─► Subscribe to Auth Changes
    │       └─► onAuthStateChange()
    │
    ├─► Check Splash Screen
    │   └─► BootSplash.hide()
    │
    ├─► Render Navigation
    │   └─► RootStack.Navigator
    │       ├─► MainTabs (if logged in)
    │       ├─► MenuTabs (if logged in)
    │       └─► AuthStack (if not logged in)
    │
    └─► Render Hard Update Modal (if needed) ◄──── NEW
        ├─► Force Update: Red, blocking
        ├─► Optional: Blue, dismissible
        └─► None: Hidden

[App Ready]
```

## 🎯 Decision Tree

```
                    User Opens App
                         │
                         ▼
                ┌─────────────────────┐
                │ Is update needed?   │
                │ (from Remote Config)│
                └────────┬────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
       NO               YES              YES
        │         (min version)      (latest version)
        │         required?          available?
        │                │                │
        ▼                ▼                ▼
    ┌──────┐        ┌──────┐        ┌──────┐
    │None  │        │Force │        │Opt   │
    │      │        │      │        │      │
    └───┬──┘        └───┬──┘        └───┬──┘
        │                │              │
        ▼                ▼              ▼
    ┌────────┐       ┌─────────┐   ┌──────────┐
    │  Show  │       │  Show   │   │  Show    │
    │   No   │       │ Red Mdl │   │ Blue Mdl │
    │  Modal │       │Blocking │   │Dismissib │
    └───┬────┘       └────┬────┘   └─────┬────┘
        │                 │              │
        ▼                 ▼              ▼
    ┌────────┐       ┌─────────┐   ┌──────────┐
    │  Show  │       │ User    │   │  User    │
    │ Main   │       │ BLOCKED │   │  HAS     │
    │  App   │       │ Cannot  │   │ OPTIONS  │
    │        │       │ use app │   │ Update   │
    └────────┘       │ until   │   │ or Later │
                     │ update  │   │          │
                     └─────────┘   └──────────┘
                         │              │ │
                         │              │ └──► Later
                         │              │      └─► Show Main App
                         │              │
                         │              └──────► Update Now
                         │                       └─► Open Store
                         │
                         └──────► Update Now
                                  └─► Open Store
```

## 📱 UI Component Hierarchy

```
AppNavigator
  │
  ├─ NavigationContainer
  │  ├─ TopMenuProvider
  │  ├─ RootStack.Navigator
  │  │  ├─ MainTabs (when authenticated)
  │  │  │  ├─ Dashboard
  │  │  │  ├─ Payments
  │  │  │  ├─ Tenants
  │  │  │  ├─ Rooms
  │  │  │  └─ Support
  │  │  │
  │  │  ├─ MenuTabs (when authenticated)
  │  │  │  ├─ Profile
  │  │  │  ├─ About
  │  │  │  └─ Settings
  │  │  │
  │  │  └─ AuthStack (when not authenticated)
  │  │     ├─ AuthScreen
  │  │     ├─ LoginScreen
  │  │     ├─ RegisterScreen
  │  │     ├─ ForgotPasswordScreen
  │  │     └─ SetNewPasswordScreen
  │  │
  │  └─ HardUpdateModal ◄────────── NEW
  │     ├─ Portal (for z-index)
  │     ├─ Modal
  │     │  ├─ Overlay (semi-transparent)
  │     │  └─ Surface (card)
  │     │     ├─ Icon (alert-circle or cloud-download)
  │     │     ├─ Title
  │     │     ├─ Message
  │     │     ├─ Buttons
  │     │     │  ├─ Update Now (always)
  │     │     │  └─ Later (optional only)
  │     │     └─ Footer text
  │     │
  │     └─ Callbacks
  │        ├─ onOpenStore() → Linking.openURL()
  │        └─ onOptionalDismiss() → setHardUpdateState()
```

## 🔗 File Relationships

```
Components / Services:

┌──────────────────────────────────────────────────────────────┐
│                   Utility/versionUtils.ts                    │
│ - compareVersions(v1, v2)                                    │
│ - needsForceUpdate(current, min)                             │
│ - hasOptionalUpdate(current, latest)                         │
│ - logVersionInfo()                                           │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                  service/updateService.ts                    │
│ - checkForUpdate() ◄──── MAIN API                           │
│ - initializeRemoteConfig()                                  │
│ - fetchRemoteConfig()                                       │
│ - getRemoteConfigValues()                                   │
│ - getStoreUrl(platform)                                     │
│ - Uses: Utility/versionUtils.ts                             │
│ - Uses: @react-native-firebase/remote-config               │
│ - Uses: react-native-device-info                            │
└─────────────────────────┬──────────────────────────────────┘
                          │
                ┌─────────┴─────────┐
                │                   │
                ▼                   ▼
    ┌──────────────────────┐  ┌──────────────────────────────┐
    │components/          │  │app/AppNavigator.tsx          │
    │HardUpdateModal.tsx  │  │ - Calls checkForUpdate()     │
    │                     │  │ - Manages modal state        │
    │ Props from          │  │ - Passes callbacks to modal  │
    │ AppNavigator.tsx:   │  │                              │
    │ - visible           │  │ Uses:                        │
    │ - isForceUpdate     │  │ - service/updateService     │
    │ - message           │  │ - components/HardUpdateMdl  │
    │ - storeUrl          │  │ - @react-native-firebase/*  │
    │ - onOptionalDismiss │  │                              │
    └──────────────────────┘  └──────────────────────────────┘
```

## 🔄 State Flow

```
App State at Different Stages:

┌─ STARTUP ────────────────────────────────────────┐
│ hardUpdateState = {                              │
│   isVisible: false,                              │
│   isForceUpdate: false,                          │
│   message: '',                                   │
│   storeUrl: ''                                   │
│ }                                                │
└──────────────────────────────────────────────────┘
                    │
                    ▼
        [Update Check Running]
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
    ┌─Force      ┌─Opt         ┌─None
    │Update      │Update       │Up to Date
    │Needed      │Available    │
    │            │             │
    ▼            ▼             ▼
┌──────────────┐┌──────────────┐┌───────────┐
│ isVisible:   ││ isVisible:   ││ isVisible:│
│   true       ││   true       ││   false   │
│ isForce:     ││ isForce:     ││ isForce:  │
│   true       ││   false      ││   false   │
│ message:     ││ message:     ││ message:  │
│  "Must       ││  "New        ││   ""      │
│   update"    ││   features"  ││           │
│ storeUrl:    ││ storeUrl:    ││ storeUrl: │
│  "https://..." "https://..."  ""         │
└──────────────┘└──────────────┘└───────────┘
     │                │                │
     ├─User taps      ├─ User taps     └─ Modal hidden
     │ "Update Now"   │  "Update Now"
     │                │  or "Later"     User can use
     │                │       │          app normally
     │                ▼       ▼
     │            Open Store  Set visible: false
     │            (Linking)   (Modal closes)
     │                │
     │                └─ User can continue
     │                   using app
     │
     └─ App frozen, cannot
        proceed until user
        updates (forced out
        of app)
```

## 🎨 UI States

```
FORCE UPDATE STATE
┌─────────────────────────────────────────┐
│  ⛔ Update Required                     │
│                                         │
│  ● [circle icon - alert-circle]         │
│    (Red background)                     │
│                                         │
│  A new version of the app is            │
│  required. Please update to             │
│  continue using the app.                │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     🔽 UPDATE NOW               │   │
│  └─────────────────────────────────┘   │
│  (no "Later" button)                    │
│                                         │
│  Available on App Store                 │
└─────────────────────────────────────┘


OPTIONAL UPDATE STATE
┌─────────────────────────────────────────┐
│  ⬆️ Update Available                    │
│                                         │
│  ✦ [circle icon - cloud-download]       │
│    (Blue background)                    │
│                                         │
│  New features and bug fixes are         │
│  available. Please update to            │
│  continue.                              │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     🔽 UPDATE NOW               │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │         LATER                   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Available on Google Play                │
└─────────────────────────────────────┘
```

## 📈 Analytics Event Flow

```
checkForUpdate() called
    │
    ├─ [always] – No event
    │
    ▼
Update check completes
    │
    ├─► status = 'force' OR 'optional'
    │   │
    │   └─► trackEvent('HardUpdate_Available', {
    │       status: 'force' | 'optional',
    │       currentVersion: string,
    │       newVersion: string
    │   })
    │
    └─► status = 'none'
        │
        └─► No event (app is current)

User sees modal
    │
    ├─► Taps "Update Now"
    │   │
    │   └─► trackEvent('HardUpdate_OpenStore', {
    │       platform: 'ios' | 'android'
    │   })
    │
    └─► Taps "Later" (optional only)
        │
        └─► trackEvent('HardUpdate_SkipOptional', {})
```

---

This architecture ensures a clean, maintainable, and user-friendly hard update system that integrates seamlessly with the existing TenantManager app while respecting the authentication flow and providing comprehensive version control management.
