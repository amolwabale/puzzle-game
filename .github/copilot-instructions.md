<!-- Copied/created for AI coding assistants: concise, actionable, repo-specific guidance -->
# Copilot / AI assistant instructions for TenantManager

This project is a React Native app (TypeScript) with Supabase for auth/data and Firebase for analytics/crash/perf. Use these notes to make safe, effective code changes.

- **Big picture**: App entry is `App.tsx` → `app/AppNavigator.tsx` (NavigationContainer + RootStack). Authentication state is stored in Supabase sessions; when present the app shows `MainTabs`, otherwise `AuthStack`.
- **Key files**:
  - `App.tsx` — app bootstrap (PaperProvider, SafeArea)
  - `app/AppNavigator.tsx` — navigation root, splash, screen perf traces, Firebase integration
  - `service/SupabaseClient.ts` — Supabase client and auth config (uses `react-native-config` env vars)
  - `navigation/StackParam.tsx` — TypeScript route param types used across navigators
  - `service/analyticsTracker.ts` — wrapper around `@react-native-firebase/analytics` for `trackEvent`/`trackScreen`

- **Architecture notes**:
  - Navigation is split into stacks (AuthStack, MainTabs, MenuTabs). See `navigation/*` for per-area screens.
  - Services live in `service/` and expose singletons (e.g., `supabase` export). Prefer reusing these instead of creating ad-hoc clients.
  - Persistent auth/session: Supabase is configured with `AsyncStorage` and `flowType: 'pkce'` — do not change session persistence semantics without testing on device.
  - Native integrations: Firebase modules (`@react-native-firebase/*`) are used for analytics, crashlytics, and performance. Runtime calls to enable Crashlytics collection exist in `app/AppNavigator.tsx`.

- **Developer workflows / commands**
  - Start Metro: `npm start` or `yarn start`
  - Android: `npm run android` / `yarn android` (or open Android Studio)
  - iOS: run `bundle install` once, then `bundle exec pod install` after native dependency changes; run `npm run ios` / `yarn ios`
  - Tests: `npm test` / `yarn test` (Jest configured)

- **Environment / secrets**
  - Uses `react-native-config`. Required env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (referenced in `service/SupabaseClient.ts`). Throwing an error when missing — ensure CI/dev env sets these.

- **Patterns & conventions**
  - Use the centralized service exports in `service/` (e.g., import `supabase` from `service/SupabaseClient.ts`) instead of creating multiple clients.
  - Telemetry: use `trackEvent`/`trackScreen` in `service/analyticsTracker.ts` for analytics events rather than calling Firebase directly.
  - Navigation types: prefer the route types from `navigation/StackParam.tsx` when typing screens to keep navigation safe.
  - UI library: `react-native-paper` is used across components; follow existing theming in `App.tsx`.

- **What to watch for when editing**
  - Changing auth/session behavior requires testing on a real device/emulator because of PKCE flow and deep linking differences.
  - Native dependency updates require CocoaPods (`ios/`) or Gradle sync (`android/`). Run `pod install` and rebuild native projects when modifying native modules.
  - Crashlytics/Analytics calls are intentionally resilient; keep try/catch behavior to avoid breaking runtime flow.

- **Where to add tests or instrumentation**
  - Unit tests live with Jest config at project root. For navigation-heavy logic, prefer integration-style tests or component tests where practical.

- **If you need to run or debug locally**
  - Reproduce auth flows on both Android and iOS emulators — Supabase + mobile OAuth (PKCE) behaves differently on platforms.
  - Use Metro logs + `console.log` for JS runtime issues and native logs via `adb logcat` (Android) / Xcode console (iOS).

If anything here is unclear or you'd like coverage of another area (build pipeline, CI, or a specific module), tell me which part and I'll expand this file.

## UI patterns & styling (codebase reference)

- **Theme**: The app uses `react-native-paper` (MD3) themes via `useTheme()` and the default `PaperProvider` in `App.tsx`. Components read `theme.colors.*` (e.g., `primary`, `onSurface`, `onSurfaceVariant`, `primaryContainer`) and sometimes fall back to older keys (`outlineVariant ?? outline`). See `components/BillingMonthPicker.tsx` for examples of reading `theme.colors` and applying fallbacks.

- **Inputs**: Text inputs are centralized and carefully tuned to avoid outline/overflow glitches:
  - `components/FormInput.tsx` enforces stable heights (single-line: sanitize newlines; multiline: stable 4-line height) and supplies a per-input `inputTheme` to align font metrics.
  - `ui/SmartTextInput.tsx` auto-measures content height for multiline fields and controls `minHeight`/`maxHeight`, `scrollEnabled`, and `onContentSizeChange` to avoid text painting outside the outline.
  - Pattern to follow: keep `mode="outlined"`, align `lineHeight` + `paddingVertical`, and set `includeFontPadding: false` on Android where needed.

- **Controls & layout**:
  - Use `Chip`, `Button`, `Dialog`, `Portal` from `react-native-paper` for common patterns. The `BillingMonthPickerDialog` composes `Chip` grid patterns with conditional `borderColor`/`backgroundColor` driven by `theme.colors`.
  - Icons use an `Icon` wrapper and accept `source` names (see `components/BillingMonthPicker.tsx`).

- **Styling approach**:
  - Prefer `StyleSheet.create` for static layout and small inline styles for theme-driven color values (merge theme colors into style arrays).
  - Avoid ad-hoc color literals; prefer `theme.colors` keys. When a variant may not exist, code usually falls back to a close key (e.g., `outlineVariant ?? outline`).

- **Spacing & typography**:
  - Components use consistent spacing (e.g., 8–12px vertical padding, 16px font size, lineHeight ~20). See `components/FormInput.tsx` and `ui/SmartTextInput.tsx` for font/line-height tuning.

- **Error / helper UI**:
  - Use `HelperText` for input errors and show/hide via boolean `visible` rather than manual Text components. See `components/FormInput.tsx`.

- **Examples to review when editing UI**:
  - `components/FormInput.tsx` — stable input behaviour, `inputTheme`, `HelperText`.
  - `ui/SmartTextInput.tsx` — measured multiline heights, `onContentSizeChange` pattern.
  - `components/BillingMonthPicker.tsx` — chip grid, theme color fallbacks, dialog styling.

If you want, I can (1) scan every screen and produce a one-line summary per screen, or (2) generate a shorter style guide JSON the team can consume. Which would you prefer?

## Standards & Rules (production-ready)

These are concrete, enforceable rules an AI assistant or contributor must follow when making changes to the codebase.

- **Project baseline**: TypeScript + React Native CLI (no Expo), React Navigation (native stack), `react-native-paper` UI, Supabase backend, `react-native-config` for env vars, `@react-native-async-storage/async-storage` for non-sensitive caching. Follow existing folder layout: `service/`, `navigation/`, `screen/`, `components/`, `ui/`, `types/`.

- **Coding standards**
  - Use strict TypeScript (no `any`). Prefer `interface`/`type` for public shapes. Add narrow union types where applicable.
  - Functional components only. Use React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`) correctly and avoid hook-order changes.
  - No deprecated RN APIs. Prefer modern equivalents (autolinking-friendly native modules, RN Navigation v6 patterns).
  - Avoid inline styles except for tiny theme-driven overrides; prefer `StyleSheet.create` and theme-aware style arrays.
  - Keep files small (~<400 lines) and single-responsibility (component, hook, or service per file).

- **Architecture rules**
  - Single responsibility layers: screens only handle composition & interaction; all network/DB logic goes into `service/*` (one exported function per endpoint). Services return typed results or throw errors.
  - Reuse centralized singletons (e.g., `supabase` from `service/SupabaseClient.ts`) rather than creating new clients.
  - Navigation definitions and screen params live under `navigation/StackParam.tsx`. Import those types into screens for typed navigation.
  - Models / DTOs go to `types/` or `model/` and are used across services and screens.

- **Naming conventions**
  - Files: PascalCase for React components/screens (`TenantFormScreen.tsx`, `FormInput.tsx`), camelCase for services and helpers (`roomService.ts`, `fetchRooms()`), kebab-case only for non-code assets if needed.
  - Components: PascalCase, props destructured in signature. Hooks: `useXxx` (camelCase). Services: singular export named function (e.g., `fetchTenants`). Constants: UPPER_SNAKE.
  - Style objects: `styles` constant via `StyleSheet.create({ ... })`.

- **State management**
  - Prefer local component state for UI concerns (visibility, form fields). Use Context sparingly for cross-cutting UI state (theme, top-menu). Do NOT introduce global state libraries without explicit need.
  - Data fetching: services + local state in screens, with `useFocusEffect` for refresh-on-focus where needed. Cache read-only lists in services or small context providers if reuse across many screens.

- **Performance rules**
  - Minimize re-renders: memoize components (`React.memo`) that receive stable props, use `useCallback` for handlers passed to children, and `useMemo` for expensive derived calculations.
  - Lists: use `FlatList` with `keyExtractor`, `getItemLayout` when possible, and `viewabilityConfig` for lazy loading images/signed URLs.
  - Avoid inline functions/objects in JSX props that affect equality on every render.
  - Use RN performance tools (Flipper, RN Firebase perf traces as in `app/AppNavigator.tsx`) for expensive screens.

- **Error handling rules**
  - All async calls must be wrapped in `try/catch`. Surface user-friendly messages (via `Alert` or in-UI `HelperText`) and log diagnostics to Crashlytics (`@react-native-firebase/crashlytics`) when available.
  - Services should either return a typed result or throw an Error; screens call services inside try/catch and handle UI state accordingly.
  - Do not swallow errors silently in new code; keep existing safe-guarded try/catch patterns where perf/telemetry is non-critical.

- **Environment / secrets**
  - Use `react-native-config` for build-time env. Required keys: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_WEB_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` for OAuth.
  - Never commit secrets to git. In CI, set env vars in secret storage. Validate presence at app start as in `service/SupabaseClient.ts` and fail-fast with a clear error.
  - Short-lived tokens or highly sensitive data should use secure storage (Keychain / EncryptedSharedPreferences) not plain AsyncStorage. Audit any new native module that stores secrets.

- **Navigation rules**
  - Use typed navigation: import route param types from `navigation/StackParam.tsx` and annotate screens (NativeStack types) for compile-time safety.
  - Keep navigator compositions shallow and prefer passing IDs/params rather than complex objects. Resolve entities inside the destination screen through services when possible.
  - Avoid deep nested navigation side-effects; use `navigation.getParent()` carefully and with types.

- **Authentication & security rules**
  - Follow the existing PKCE flow for Supabase mobile OAuth (`flowType: 'pkce'`) and keep session persistence with AsyncStorage as configured.
  - Auth lifecycle: App-level session restore at startup (see `AppNavigator.tsx`), a single auth state listener (supabase.auth.onAuthStateChange), and screen gating based on session presence.
  - After login, set analytics/crashlytics user id (see `service/analyticsTracker.ts` and `AppNavigator.tsx`).
  - File uploads/downloads: enforce maximum sizes (20MB currently), create signed URLs server-side via Supabase storage, and validate file types/extensions before uploading/downloading.
  - Network: always use HTTPS endpoints; validate/sanitize inputs sent to backend.

- **API & service rules**
  - All network or storage interactions must go through `service/*`. No direct fetch/axios or supabase calls in screens except using those services.
  - Services must handle HTTP/supabase errors, map them to meaningful messages, and throw exceptions for screens to handle.

- **Code quality / duplication**
  - Deduplicate common UI (hero cards, empty states, rows) into `components/` and reuse them.
  - Centralize utility helpers (date formatting, money formatting) under `utility/` or `service/` with types and unit tests.

- **Testing expectations**
  - Unit tests: every `service/*` function must have unit coverage (mock network). Use Jest with proper mocks for `supabase`, RNFB, and native modules.
  - Component tests: critical UI components and screens should have tests with `@testing-library/react-native` for interactions and snapshot stability.
  - CI: run `npm test` and TypeScript checks (`tsc --noEmit`) on PRs; fail on lint/type/test regressions.

- **PR & review rules**
  - Small, focused PRs. Each PR must include: summary, list of files changed, rationale for behavior changes, and test instructions. Link to relevant ticket/issue.
  - When touching auth, native modules, or storage rules, include manual test steps and device platform notes (Android/iOS differences).

Follow these rules exactly when making changes or generating code. If a proposed change requires breaking any rule, add a short justification to the PR and get an explicit review from a maintainer.


## Per-screen summaries (one-line)
- `screen/Dashboard/DashboardScreen.tsx`: Main dashboard with billing/month picker, KPI tiles, collection stats, and heavy use of `Surface` hero cards and `ProgressBar` widgets.
- `screen/Payment/PaymentScreen.tsx`: Payments list with filters, lazy signed-photo loading, and PaymentCard rows with FAB to add payments.
- `screen/Payment/PaymentViewScreen.tsx`: Detailed bill view, share/download, record payment modal, PDF/view-shot support and signed URL handling.
- `screen/Payment/PaymentFormScreen.tsx`: Add/edit payment form with room/tenant pairing, meter reading calculations, billing month picker.
- `screen/Tenant/TenantScreen.tsx`: Tenant list with search, signed-photo lazy loading, and TenantCard actions (view/edit/delete).
- `screen/Tenant/TenantViewScreen.tsx`: Tenant detail with signed-photo downloads, document sharing, and Supabase storage interactions.
- `screen/Tenant/TenantFormScreen.tsx`: Tenant add/edit form with file uploads (profile/adhar/pan/agreement), file size checks (20MB), and image picker integration.
- `screen/Room/RoomScreen.tsx`: Rooms list with occupancy chips, filters, and lazy occupant photo signing.
- `screen/Room/RoomViewScreen.tsx`: Room detail with KPIs, tenant occupancy card, and history list using `Surface` rows.
- `screen/Room/RoomFormScreen.tsx`: Room add/edit with tenant assignment, date pickers, and meter-reading sync logic.
- `screen/Identity/AuthScreen.tsx`: Entry auth surface with Google Sign-In, themed hero and action buttons.
- `screen/Identity/LoginScreen.tsx`: Login form using `FormInput`, outlined inputs, and hero card styling.
- `screen/Identity/RegisterScreen.tsx`: Registration form with two-column rows, background blobs, and FormInput usage.
- `screen/Support/SupportScreen.tsx`: Tickets list with search, TicketCard rows, and empty-state CTA.
- `screen/Support/AddTicketScreen.tsx`: New ticket form with file attachment options (gallery/files), uses `FormInput` multiline.
- `screen/Support/TicketChatScreen.tsx`: Chat UI with WhatsApp-like composer, keyboard height animation handling, and `ChatBubble` components.
- `screen/Support/SupportDocumentViewScreen.tsx`: WebView document viewer with Google viewer fallback for Android PDFs.
- `screen/Support/components/ChatBubble.tsx`: Chat bubble styling switching primary-container for sender, white for receiver.
- `screen/Support/components/TicketCard.tsx`: Compact ticket preview card with `StatusChip` and highlight-on-search.
- `screen/Support/components/StatusChip.tsx`: Small status chip with explicit color tones per status (OPEN/IN_PROGRESS/RESOLVED/CLOSED).
- `screen/Menu/Profile/ProfileScreen.tsx`: Profile summary with hero, meta pill and edit FAB.
- `screen/Menu/Profile/ProfileFormScreen.tsx`: Profile edit form with validation, max lengths, and `FormInput` fields.
- `screen/Menu/About/AboutUsScreen.tsx`: About page with feature bullets and multiple theme-driven blobs.
- `screen/Setting/SettingScreen.tsx`: Property settings form with numeric validation and day-of-month pickers.

## Structured style-guide (JSON reference)
```json
{
  "themeKeys": [
    "primary","primaryContainer","secondary","secondaryContainer",
    "onSurface","onSurfaceVariant","outline","outlineVariant","error","background"
  ],
  "typography": {
    "bodyFontSize": 16,
    "bodyLineHeight": 20,
    "labelFontSize": 14,
    "labelLineHeight": 18,
    "weights": "900 (titles), 800 (subtitles), 700 (content)"
  },
  "spacing": {
    "gutter": 16,
    "sectionPadding": 12,
    "cardRadius": 16,
    "heroRadius": 18
  },
  "inputs": {
    "mode": "outlined",
    "singleLineHeight": 48,
    "multilineStableLines": 4,
    "multilineMinHeight": 120,
    "fontSize": 16,
    "lineHeight": 20,
    "android": { "includeFontPadding": false }
  },
  "components": {
    "chips": "use theme.colors for border/background; selected → primary/primaryContainer",
    "hero": "Surface with icon badge (primaryContainer) + title (onSurface) + subtitle (onSurfaceVariant)",
    "fabBottomOffset": "24 default; when keyboard open: keyboardHeight + 75",
    "fileUploadLimitBytes": 20971520,
    "signedUrlBucket": "tenant-manager (supabase storage)"
  },
  "patterns": [
    "Prefer centralized services in /service (supabase single export)",
    "Telemetry via service/analyticsTracker.trackEvent/trackScreen",
    "Handle native-module failures gracefully (try/catch around RNFB calls)",
    "Use stable input metrics (fontSize+lineHeight) to avoid outline overflow"
  ]
}
```

If you'd like, I can (a) export the above JSON to `design/style-guide.json`, or (b) produce a one-line summary CSV. Which do you want next?
