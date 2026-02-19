# TenantManager — Architecture Overview

> **Last updated:** 2026-02-19  
> A React Native mobile app (iOS & Android) for landlords to manage tenants, rooms, billing, and support tickets, backed by Supabase.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.83.1 (TypeScript) |
| UI Library | React Native Paper (Material Design) |
| Navigation | React Navigation v7 (native-stack + bottom-tabs) |
| Backend / Database | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Server-State / Cache | TanStack React Query v5 |
| Analytics | Firebase Analytics + Firebase Performance |
| Auth | Supabase Email/Password + Google Sign-In |
| File Storage | Supabase Storage (`tenant-manager` bucket) |
| Config | `react-native-config` (`.env` file) |

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                         App.tsx                          │
│   SafeAreaProvider > QueryClientProvider > PaperProvider │
│                      AppNavigator                        │
└──────────────────────────────────────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │       AppNavigator.tsx     │  (auth gate)
              │  session? MainTabs/Menu    │
              │          : AuthStack       │
              └─────────────┬─────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
  AuthStack            MainTabs             MenuTabs
  (login/register)  (Dashboard/Tenant/  (Profile/Password/
                    Room/Payment/Support) Support)
```

---

## Directory Structure & Module Responsibilities

### `App.tsx` — Application Root
- Configures global providers: **SafeAreaProvider**, **QueryClientProvider**, **PaperProvider**
- Registers locale for date pickers (`react-native-paper-dates`)
- Mounts `AppNavigator`

---

### `app/` — App-Level Bootstrap
| File | Responsibility |
|---|---|
| `AppNavigator.tsx` | **Auth guard**: restores session on startup via Supabase, listens to auth state changes; routes to `AuthStack` (unauthenticated) or `MainTabs`/`MenuTabs` (authenticated). Also hides the native boot splash. |
| `queryClient.ts` | Configures the shared TanStack React Query client instance |

---

### `navigation/` — Navigation Configuration
All navigation is typed via `StackParam.tsx`.

| File | Responsibility |
|---|---|
| `StackParam.tsx` | TypeScript type definitions for all navigator param lists |
| `AuthStack.tsx` | Stack for unauthenticated screens (AuthScreen, Login, Register) |
| `MainTabs.tsx` | Root bottom tab navigator for authenticated users |
| `DashboardStack.tsx` | Stack within the Dashboard tab |
| `TenantStack.tsx` | Stack: TenantList → TenantView → TenantForm → TenantDocument |
| `RoomStack.tsx` | Stack: RoomList → RoomView → RoomForm |
| `PaymentsStack.tsx` | Stack: PaymentList → PaymentView → PaymentForm |
| `SupportStack.tsx` | Stack: SupportTicketList → SupportNewTicket → SupportTicketChat → SupportDocument |
| `SettingsStack.tsx` | Stack for Settings screen |
| `MenuTabs.tsx` | Separate bottom-tab area: Home, Profile, ChangePassword, Support |
| `TopMenuButton.tsx` | Header button that opens the TopMenuDrawer |
| `TopMenuDrawer.tsx` | Context-based side drawer (React Context + Provider pattern) |
| `TopBackButton.tsx` | Reusable back button header component |

---

### `screen/` — UI Screens
Screens are grouped by feature area:

| Module | Screens |
|---|---|
| `Dashboard/` | Dashboard home (overview/stats) |
| `Tenant/` | Tenant list, view detail, add/edit form |
| `Room/` | Room list, view detail, add/edit form |
| `Payment/` | Bill list, bill detail/view, create/edit bill form |
| `Support/` | Support ticket list, new ticket, ticket chat, document viewer |
| `Menu/` | Profile, change password, menu home, support (accessible from the side menu) |
| `Identity/` | Auth screens: entry/splash, login, registration |
| `Setting/` | App settings (water rate, electricity unit, rent dates, property info) |

---

### `service/` — Data & Business Logic Layer
All services interact with Supabase and are **user-scoped** (every query filters by `user_id`).

| Service File | Responsibility |
|---|---|
| `SupabaseClient.ts` | Initializes the singleton Supabase JS client using env config |
| `authSession.ts` | Reads the current authenticated user/session from Supabase; used by all other services |
| `IdentityService.ts` | User registration (via Edge Function), email/password login, Google OAuth login |
| `tenantService.ts` | Full CRUD for tenants; file upload/delete (profile photo, Aadhaar, PAN, agreement) to Supabase Storage with rollback on failure |
| `RoomService.ts` | Full CRUD for rooms |
| `TenantRoomService.ts` | Manages the `tenant_room_mapping` join table: assign tenant to room, vacate room, fetch tenant history per room, fetch active room per tenant (with FK join + fallback strategy) |
| `BillService.ts` | Full CRUD for bills; `updateBillPayment` for partial/full payment recording; fetches `setting` table for default rates |
| `MeterReadingService.ts` | Handles electricity meter reading records |
| `MenuService.ts` | User profile CRUD, password change + force logout; support ticket CRUD + ticket chat; file upload to Support path in Supabase Storage |
| `ticketService.ts` | Thin ticket helpers (likely utilities used by MenuService) |
| `ticketTypes.ts` | Shared TypeScript types for Ticket, TicketChat, TicketStatus, FileInput |
| `analyticsTracker.ts` | Wraps Firebase Analytics: `trackScreen(name)` and `trackEvent(name, params)` |
| `signedUrlCache.ts` | Caches Supabase signed URLs to avoid repeated network calls for the same file |
| `readUriAsArrayBuffer.ts` | Converts file URIs (including Android `content://` URIs) to `ArrayBuffer` for Supabase Storage upload |

---

### `model/` — Data Models / DTOs
| File | Responsibility |
|---|---|
| `Register.ts` | `RegisterPayload` and `RegisterResponse` interfaces for user registration |

> Additional domain types are defined inline within each service file (e.g., `TenantRecord`, `RoomRecord`, `BillRecord`).

---

### `components/` — Reusable UI Components
| File | Responsibility |
|---|---|
| `FormInput.tsx` | Generic form text input with label, validation styling |
| `BillingMonthPicker.tsx` | Month/year picker component for billing forms |

---

### `ui/` — Low-Level UI Primitives
| File | Responsibility |
|---|---|
| `SmartTextInput.tsx` | Enhanced text input with smart behavior (e.g., auto-focus, dismiss keyboard helpers) |

---

### `database/` — Database Reference
| File | Responsibility |
|---|---|
| `schema.txt` | SQL DDL for the `User` table (reference/documentation) |

---

### `supabase/` — Backend Reference (Supabase Cloud)
| File | Responsibility |
|---|---|
| `edgeFunction.txt` | Supabase Edge Function (Deno/Hono): handles `/register` endpoint — creates the Auth user via admin API and inserts a row in the `User` table atomically |
| `trigger.txt` | PostgreSQL trigger definitions (e.g., auto-update `modified_at` timestamps) |

---

## Database Tables (Supabase PostgreSQL)

| Table | Description |
|---|---|
| `User` | Landlord/owner profile (linked to Supabase Auth `user_id`) |
| `tenant` | Tenant records with documents and contact info |
| `room` | Room records with type, area, rent, deposit |
| `tenant_room_mapping` | Join table tracking which tenant is/was in which room (joining_date / leaving_date) |
| `bill` | Monthly rent bills with meter readings, utilities, payment status |
| `setting` | Per-user property settings (water rate, electricity unit, rent dates) |
| `ticket` | Support tickets raised by landlord |
| `ticket_chat` | Chat messages per support ticket |

---

## Authentication Flow

```
App Start
  │
  ├─ supabase.auth.getSession()
  │     ├─ Session found → set userId in Firebase Analytics → render MainTabs
  │     └─ No session → render AuthStack
  │
  ├─ AuthStack
  │     ├─ Login (email/password)  → IdentityService.Login()
  │     ├─ Login (Google)          → IdentityService.LoginWithGoogleIdToken()
  │     └─ Register                → IdentityService.RegisterUser() → Supabase Edge Function
  │
  └─ supabase.auth.onAuthStateChange() → reactively update session state
```

---

## File Storage Structure (Supabase Storage)

All files live in the **`tenant-manager`** bucket, organized by path:

```
tenant-manager/
  {userId}/
    {tenantId}/
      profile_photo.{ext}
      pan_card.{ext}
      adhar_card.{ext}
      agreement.{ext}
    Support/
      {ticketId}/
        {fileName}
```

---

## Key Patterns

| Pattern | Where Used |
|---|---|
| **User-scoped queries** | Every service filters by `user_id` from `authSession.getCurrentUserId()` |
| **Optimistic file rollback** | `tenantService.saveTenant` rolls back uploaded files if DB update fails |
| **FK join + fallback** | `TenantRoomService` attempts Supabase relational join first; falls back to manual mapping if FK relationship isn't configured |
| **Signed URL cache** | `signedUrlCache.ts` caches time-limited signed URLs to reduce redundant Supabase Storage calls |
| **React Query for server state** | All data fetching/mutations use TanStack React Query for caching, background refresh, and loading states |
| **Analytics wrapper** | All Firebase Analytics calls go through `analyticsTracker.ts` and fail silently to avoid affecting UX |
| **Edge Function for registration** | Admin-level user creation (bypasses email confirmation) is done server-side via a Deno Edge Function to keep service role key off the client |
