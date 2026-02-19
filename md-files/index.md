# TenantManager – Complete File Index

> Auto-generated index of all source files (excludes `android/`, `ios/`, `node_modules/`, `.git/`).
> Line counts are as of indexing date. Sorted by folder then filename.

---

## Root

| File | Lines | Description |
|---|---|---|
| `App.tsx` | 28 | App entry point. Wraps the entire app in `SafeAreaProvider`, `PaperProvider` (MD3 theme), `QueryClientProvider`, and mounts `AppNavigator`. Registers locale for `react-native-paper-dates`. |
| `index.js` | 67 | React Native entry point. Registers the `App` component with `AppRegistry`. |
| `package.json` | 77 | NPM manifest: dependencies, scripts (`android`, `ios`, `iphone17pro`, `start`, `test`, `format`, `package-android`, `update-ios`). |
| `tsconfig.json` | 8 | TypeScript compiler config (strict mode, path aliases). |
| `babel.config.js` | — | Babel transform config for React Native. |
| `metro.config.js` | 11 | Metro bundler config. |
| `jest.config.js` | 3 | Jest test runner config. |
| `.eslintrc.js` | — | ESLint rules. |
| `.prettierrc.js` | — | Prettier formatting rules. |
| `.env` | 5 | Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_ID`, `GOOGLE_WEB_CLIENT_ID`. **Never commit.** |
| `.watchmanconfig` | — | Watchman file-watcher config. |
| `app.json` | — | React Native app metadata (name, display name). |
| `settings.json` | 7 | Project-level settings (editor/tooling config). |
| `Gemfile` | — | Ruby gems for CocoaPods (iOS dependency manager). |
| `README.md` | — | Project readme. |

---

## `app/`  — App Bootstrap

| File | Lines | Description |
|---|---|---|
| `AppNavigator.tsx` | 106 | Root navigator. Listens to `supabase.auth.onAuthStateChange` and switches between `AuthStack`, `MainTabs`, and `MenuTabs`. Hides splash screen on first render. |
| `queryClient.ts` | 15 | Creates and exports the global React Query `QueryClient` with `staleTime: 30s`, `gcTime: 10m`, `retry: 1`. |

---

## `components/`  — Shared UI Components

| File | Lines | Description |
|---|---|---|
| `FormInput.tsx` | 170 | Standard form text input wrapping `react-native-paper` `TextInput`. Handles stable single-line (h=48) and 4-line multiline heights, MD3 font alignment, inline `HelperText` error. Use for all form fields. |
| `BillingMonthPicker.tsx` | 309 | Reusable month/year picker component used in Payment screens. Shows a scrollable month grid; returns a `YYYY-MM` formatted string. |

---

## `ui/`  — Low-Level UI Primitives

| File | Lines | Description |
|---|---|---|
| `SmartTextInput.tsx` | 157 | Auto-growing `TextInput` wrapper. Measures content height via `onContentSizeChange` and clamps between `minHeight` and `maxLines × lineHeight`. Prevents text overflow outside outlined border. |

---

## `model/`  — TypeScript Interfaces

| File | Lines | Description |
|---|---|---|
| `Register.ts` | 14 | Defines `RegisterPayload` (email, password, firstName, lastName, mobile?, address?) and `RegisterResponse` (success, userId?, error?). |

---

## `navigation/`  — Navigators & Navigation Helpers

| File | Lines | Description |
|---|---|---|
| `StackParam.tsx` | 45 | Central param-list type definitions for all stacks: `AuthStackParamList`, `RootStackParamList`, `TenantStackParamList`, `RoomStackParamList`, `PaymentsStackParamList`, `SettingsStackParamList`, `SupportStackParamList`. |
| `AuthStack.tsx` | 41 | Native stack for unauthenticated flow: `AuthScreen → LoginScreen → RegisterScreen`. |
| `MainTabs.tsx` | 100 | Bottom tab navigator with 5 tabs: **Home** (Dashboard), **Tenants**, **Rooms**, **Payments**, **Settings**. Tracks screen changes via `trackScreen()`. |
| `MenuTabs.tsx` | 243 | Drawer-style overlay navigator for the side menu: `MenuHome`, `MenuProfile`, `MenuChangePassword`, `MenuSupport`. |
| `DashboardStack.tsx` | 29 | Stack wrapping `DashboardScreen`. |
| `TenantStack.tsx` | 82 | Stack: `TenantList → TenantView → TenantForm → TenantDocumentView`. |
| `RoomStack.tsx` | 70 | Stack: `RoomList → RoomView → RoomForm`. |
| `PaymentsStack.tsx` | 70 | Stack: `PaymentScreen → PaymentForm → PaymentView`. |
| `SettingsStack.tsx` | 29 | Stack wrapping `SettingScreen`. |
| `SupportStack.tsx` | 71 | Stack: `SupportList → AddTicket → SupportTicketChat → SupportDocumentView`. |
| `TopBackButton.tsx` | 95 | Custom back button placed in stack navigator headers. |
| `TopMenuButton.tsx` | 51 | Custom hamburger/menu button placed in stack navigator headers (opens `MenuTabs`). |
| `TopMenuDrawer.tsx` | 295 | Animated slide-in drawer overlay (the actual menu panel content). |

---

## `screen/`  — Feature Screens

### `screen/Identity/`  — Authentication

| File | Lines | Description |
|---|---|---|
| `AuthScreen.tsx` | 663 | Landing/welcome screen. Shows app hero, Login, Create account, and **Continue with Google** buttons. Handles Google OAuth (PKCE on iOS, native ID token on Android), deep-link callbacks, and Supabase session exchange. |
| `LoginScreen.tsx` | 373 | Email + password login form. Uses `FormInput`, validates fields, calls `Login()` from `IdentityService`. |
| `RegisterScreen.tsx` | 520 | New user registration form. Collects email, password, first/last name, mobile, address. Calls `RegisterUser()` via Supabase Edge Function. |

---

### `screen/Dashboard/`  — Home Dashboard

| File | Lines | Description |
|---|---|---|
| `DashboardScreen.tsx` | 1793 | Main dashboard. Shows summary cards: total rooms, active tenants, pending bills, recent payments, meter readings due. Uses React Query for cached data. Largest screen file. |

---

### `screen/Tenant/`  — Tenant Management

| File | Lines | Description |
|---|---|---|
| `TenantScreen.tsx` | 498 | Tenant list view. Shows searchable/filterable list of tenants with room info badges. FAB to add new tenant. |
| `TenantViewScreen.tsx` | 850 | Tenant detail view. Shows all tenant info, room assignment history, ID document previews, and action buttons (edit, assign room, generate bill). |
| `TenantFormScreen.tsx` | 670 | Add/edit tenant form. Fields: name, mobile, alternate mobile, family members, address, company, Aadhaar card photo, PAN card photo. FAB save. |
| `TenantDocumentViewScreen.tsx` | 71 | Full-screen document/image viewer for tenant ID documents (Aadhaar, PAN). Uses Supabase signed URL via `getSignedUrlCached`. |

---

### `screen/Room/`  — Room Management

| File | Lines | Description |
|---|---|---|
| `RoomScreen.tsx` | 708 | Room list view. Shows all rooms with occupancy status, rent amount, and type. FAB to add new room. |
| `RoomViewScreen.tsx` | 638 | Room detail view. Shows room details, current tenant, tenant history, and action buttons (edit, assign tenant). |
| `RoomFormScreen.tsx` | 1067 | Add/edit room form. Fields: name, type, area, rent, deposit, comment. FAB save. |

---

### `screen/Payment/`  — Billing & Payments

| File | Lines | Description |
|---|---|---|
| `PaymentScreen.tsx` | 1136 | Payment list view. Filterable by tenant/room/month. Shows bill summary cards with payment status chips. |
| `PaymentFormScreen.tsx` | 1380 | Generate/edit bill form. Fields: billing month (uses `BillingMonthPicker`), rent, water, electricity (previous + current meter readings), ad-hoc amount. Auto-calculates total. FAB save. |
| `PaymentViewScreen.tsx` | 2553 | Bill detail view. Shows full bill breakdown, payment status, meter reading history, and PDF-style summary. Largest file in the project. |

---

### `screen/Setting/`  — Property Settings

| File | Lines | Description |
|---|---|---|
| `SettingScreen.tsx` | 649 | Property configuration screen. Fields: property name, address, water rate, electricity unit rate, rent date (day of month), rent due date. Inline day-picker dialog using `Chip` grid. FAB save. |

---

### `screen/Support/`  — Support Tickets

| File | Lines | Description |
|---|---|---|
| `AddTicketScreen.tsx` | 272 | Create new support ticket form. Fields: title, description, optional file attachment (gallery or document picker). |
| `TicketChatScreen.tsx` | 645 | Real-time chat interface for a support ticket. Shows message thread with `ChatBubble` components, file attachment preview, and a message composer. |
| `SupportDocumentViewScreen.tsx` | 69 | Full-screen viewer for documents/images attached to support ticket messages. |
| `components/ChatBubble.tsx` | 73 | Chat message bubble component (user vs. support sides). |
| `components/StatusChip.tsx` | 64 | Ticket status badge chip (`open`, `in_progress`, `closed`). |
| `components/TicketCard.tsx` | 109 | Summary card for a support ticket shown in the ticket list. |

---

### `screen/Menu/`  — Side Menu Screens

| File | Lines | Description |
|---|---|---|
| `Profile/ProfileScreen.tsx` | 339 | Read-only profile view. Shows user's name, email, mobile, address, and avatar initials. Button to go to edit form. |
| `Profile/ProfileFormScreen.tsx` | 336 | Edit profile form. Fields: first name, last name, mobile, address. FAB save. Calls `updateUserProfile()` from `MenuService`. |
| `ChangePasswordScreen.tsx` | 171 | Change password form. Collects new password + confirmation. On success calls `changePasswordAndLogout()` — user is signed out and must re-login. |
| `SupportScreen.tsx` | 197 | Support ticket list view within the Menu. Shows open/closed tickets with status chips. Link to `AddTicketScreen`. |
| `About/AboutUsScreen.tsx` | 363 | About the app screen. Shows app info, version, team details, and links. |

---

## `service/`  — Backend / Data Layer

| File | Lines | Description |
|---|---|---|
| `SupabaseClient.ts` | 24 | Creates and exports the singleton Supabase client using `SUPABASE_URL` and `SUPABASE_ANON_KEY` from `.env`. |
| `authSession.ts` | 29 | Helper functions: `getCurrentUserId()` (returns UUID string, throws if not logged in), `getCurrentSessionUser()` (returns full user object). |
| `IdentityService.ts` | 52 | `RegisterUser()` — calls Supabase Edge Function `/register`. `Login()` — Supabase email/password sign-in. `LoginWithGoogleIdToken()` — Android path: signs in with Google ID token. |
| `tenantService.ts` | 316 | Full CRUD for tenants: `fetchTenants()`, `fetchTenantById()`, `saveTenant()` (upsert), `deleteTenant()`, `uploadTenantDocument()` (Aadhaar/PAN photo upload to Storage). |
| `RoomService.ts` | 121 | Full CRUD for rooms: `fetchRooms()`, `fetchRoomById()`, `saveRoom()` (upsert), `deleteRoom()`. |
| `TenantRoomService.ts` | 379 | Tenant-room assignment management: `assignTenantToRoom()`, `vacateRoom()`, `fetchActiveAssignment()`, `fetchTenantHistory()`, `fetchRoomHistory()`. Also manages `TenantHistoryRecord` and move-in/move-out logic. |
| `BillService.ts` | 245 | Billing operations: `fetchBills()`, `fetchBillById()`, `saveBill()` (upsert with electricity calculation), `deleteBill()`, `markBillPaid()`. Maintains `BillRecord` type. |
| `MeterReadingService.ts` | 118 | Electricity meter readings: `fetchLatestMeterReading()`, `saveMeterReading()`. Stores previous and current readings per room/month. |
| `MenuService.ts` | 321 | User-profile CRUD: `fetchUserProfile()`, `updateUserProfile()`. Password: `changePasswordAndLogout()`. Support tickets: `fetchTickets()`, `fetchTicketById()`, `addTicketMessage()`, `uploadTicketAttachment()`. |
| `ticketService.ts` | 48 | `createTicket()` — creates a new support ticket with optional file upload. |
| `ticketTypes.ts` | 28 | Shared types for support: `Ticket`, `TicketChat`, `TicketStatus`, `FileInput`. |
| `signedUrlCache.ts` | 37 | `getSignedUrlCached(queryClient, fullUrl, opts)` — fetches Supabase Storage signed URLs and caches them in React Query with a 5-minute expiry buffer. |
| `analyticsTracker.ts` | 26 | `trackEvent(name, params)` and `trackScreen(name)` — thin wrappers around Firebase Analytics `logEvent`. |
| `readUriAsArrayBuffer.ts` | 88 | Cross-platform utility to convert a local file URI (from picker) to an `ArrayBuffer` for Supabase Storage upload. |

---

## `database/`  — Database Reference

| File | Lines | Description |
|---|---|---|
| `schema.txt` | 11 | Supabase Postgres DDL for the `User` table (id, created_at, first_name, last_name, mobile, email, address, user_id). Reference only. |

---

## `supabase/`  — Supabase Backend Reference

| File | Lines | Description |
|---|---|---|
| `edgeFunction.txt` | 79 | Reference implementation of the `tenant-manager/register` Supabase Edge Function (creates auth user + inserts into `User` table in a single call). |
| `trigger.txt` | 56 | Reference PostgreSQL trigger SQL (e.g., auto-create User row on auth.users insert). |

---

## `prompts/`  — AI Coding Prompts

| File | Lines | Description |
|---|---|---|
| `ui-design.txt` | 15 | Prompt template for general UI design instructions. |
| `transform-existing-screen.txt` | 83 | Prompt for transforming/refactoring an existing screen to match project conventions. |
| `best-chatui-design.txt` | 163 | Prompt capturing the best chat UI design patterns used in the support ticket chat screen. |

---

## `assets/`  — Static Assets

| File | Description |
|---|---|
| `launcher-icon-crop.jpg` | App launcher icon (JPEG). |
| `launcher-icon-crop.png` | App launcher icon (PNG). |
| `splash-icon.png` | Splash screen icon. |

---

## `bootsplash-assets/`  — Boot Splash Screen Assets

| File | Description |
|---|---|
| `logo.png` | Base boot splash logo. |
| `logo@1,5x.png` | 1.5× density logo. |
| `logo@2x.png` | 2× density logo. |
| `logo@3x.png` | 3× density logo. |
| `logo@4x.png` | 4× density logo. |
| `manifest.json` | Bootsplash asset manifest. |

---

## `md-files/`  — Project Documentation

| File | Lines | Description |
|---|---|---|
| `index.md` | — | **This file.** Complete project file index. |
| `rules.md` | 613 | Coding conventions, patterns, and rules for the project (theme, components, save flow, data fetching, caching, navigation, etc.). |
| `architecture.md` | 226 | High-level architecture overview: module diagram, layer responsibilities, data flow. |

---

## Summary Statistics

| Category | Count |
|---|---|
| Screens | 19 |
| Screen sub-components | 3 |
| Navigation files | 13 |
| Service files | 14 |
| Shared components | 2 |
| UI primitives | 1 |
| Model/type files | 1 |
| Documentation (md-files) | 3 |
| Config/tooling | 10 |
| Assets | 9 |
| Database/Supabase reference | 3 |
| Prompts | 3 |
| **Total tracked files** | **~81** |
