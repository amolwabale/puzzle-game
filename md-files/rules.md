# TenantManager – Project Coding Conventions & Rules

> This document captures the established patterns and conventions used throughout the codebase. Follow them when adding new screens, services, or components.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native (TypeScript) |
| UI Kit | `react-native-paper` (MD3 / Material Design 3) |
| Navigation | `@react-navigation/native` – Native Stack + Bottom Tabs |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Server-state cache | `@tanstack/react-query` (React Query v5) |
| Analytics | Firebase Analytics via `@react-native-firebase/analytics` |
| Config/env | `react-native-config` (.env file) |
| Image picker | `react-native-image-picker` |
| Document picker | `@react-native-documents/picker` |
| Auth (Google) | `@react-native-google-signin/google-signin` + Supabase OAuth |
| Safe area | `react-native-safe-area-context` |
| Splash screen | `react-native-bootsplash` |

---

## 2. Project Folder Structure

```
TenantManager/
├── app/                    # App bootstrap: AppNavigator, queryClient
├── components/             # Shared UI components (FormInput)
├── ui/                     # Lower-level UI primitives (SmartTextInput)
├── navigation/             # All stack/tab navigators + StackParam types
├── screen/                 # Feature screens, grouped by domain
│   ├── Identity/           # AuthScreen, LoginScreen, RegisterScreen
│   ├── Dashboard/          # DashboardScreen
│   ├── Tenant/             # TenantList, TenantView, TenantForm, TenantRoomHistory
│   ├── Room/               # RoomList, RoomView, RoomForm
│   ├── Payment/            # PaymentScreen, PaymentForm, PaymentView
│   ├── Setting/            # SettingScreen
│   ├── Support/            # SupportList, AddTicket, TicketChat, …
│   └── Menu/               # MenuHome, MenuProfile, ChangePassword, MenuSupport
├── service/                # All Supabase / API calls (one file per domain)
├── model/                  # TypeScript interface/type definitions
├── database/               # Database schema reference (schema.txt)
├── supabase/               # Supabase edge functions & triggers (reference .txt)
├── Utility/                # Miscellaneous utilities
├── assets/                 # Static image/icon assets
└── md-files/               # Project documentation (this file lives here)
```

---

## 3. Theme & Color Conventions

### 3.1 Always use the MD3 theme token, never raw hex in JSX
```tsx
const theme = useTheme(); // from react-native-paper
// ✅ Correct
backgroundColor: theme.colors.primary
// ❌ Avoid in JSX (only acceptable in StyleSheet fallbacks)
backgroundColor: '#6750A4'
```

### 3.2 Common theme tokens used
| Token | Usage |
|---|---|
| `theme.colors.primary` | Primary brand color, active icons |
| `theme.colors.onPrimary` | Text/icons on primary background |
| `theme.colors.surface` | Card/Surface background (`#FFFFFF` equivalent) |
| `theme.colors.onSurface` | Primary text on surfaces |
| `theme.colors.onSurfaceVariant` | Secondary/muted text |
| `theme.colors.background` | Screen root background (`#F4F6FA` equivalent) |
| `theme.colors.primaryContainer` | Icon badge backgrounds, selected chips |
| `theme.colors.secondaryContainer` | Feature icon backgrounds |
| `theme.colors.error` | Error text |
| `theme.colors.outline` | Borders |

### 3.3 `outlineVariant` helper — always use this utility function for borders
Defined in every screen that uses border colors:
```tsx
function outlineColor(theme: any) {
  return (theme.colors as any).outlineVariant ?? theme.colors.outline;
}
```
Apply as: `borderColor: outlineColor(theme)` on `Surface` cards.

### 3.4 Background color for screens
```tsx
// Screen root view
backgroundColor: '#F4F6FA'   // light gray page background (matches theme.colors.background)

// Cards / Surfaces
backgroundColor: '#FFFFFF'
```

### 3.5 Hardcoded text colors (in StyleSheet only)
```
'#111827'  → primary text (dark)
'#6B7280'  → secondary/muted text
'#E5E7EB'  → subtle border fallback
```

---

## 4. Component Conventions

### 4.1 Surface cards — the standard layout container
Every content section is wrapped in a `Surface` from `react-native-paper`:
```tsx
<Surface
  style={[styles.card, { borderColor: outlineColor(theme), backgroundColor: theme.colors.surface }]}
  elevation={2}
>
  {/* content */}
</Surface>
```
- `elevation={2}` is the project standard
- `borderRadius: 16` or `18` for hero cards, `16` for section cards
- `borderWidth: 1` always set together with `borderColor`

### 4.2 Hero card — top-of-screen identity block
Every form/detail screen opens with a hero block:
```tsx
<Surface style={[styles.hero, { borderColor: outlineColor(theme) }]} elevation={2}>
  <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
    <Icon source="<icon-name>" size={18} color={theme.colors.primary} />
  </View>
  <View style={{ flex: 1, minWidth: 0 }}>
    <Text style={[styles.heroTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
      Screen Title
    </Text>
    <Text style={[styles.heroSub, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
      Short subtitle / description
    </Text>
  </View>
</Surface>
```
Hero icon wrap sizes:
- `width: 36, height: 36, borderRadius: 14` (standard)
- `width: 40, height: 40, borderRadius: 16` (large hero, AuthScreen)

### 4.3 Section title row — icon + title inside a card
```tsx
<View style={styles.sectionTitleRow}>
  <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primaryContainer }]}>
    <Icon source="<icon-name>" size={18} color={theme.colors.primary} />
  </View>
  <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
    Section Title
  </Text>
</View>
```
Standard icon box: `width: 36, height: 36, borderRadius: 14`.

### 4.4 Auth screen background decoration — blob accents
Auth screens (AuthScreen, LoginScreen) use absolute-positioned blobs:
```tsx
<View pointerEvents="none" style={styles.bgAccents}>
  <View style={[styles.blob, styles.blobOne, { backgroundColor: theme.colors.primaryContainer, opacity: 0.55 }]} />
  <View style={[styles.blob, styles.blobTwo, { backgroundColor: theme.colors.secondaryContainer, opacity: 0.45 }]} />
</View>
```
Blob sizes: `260x260` (top-left) and `220x220` (bottom-right), `borderRadius: 999`.

---

## 5. Form Input Conventions

### 5.1 Use `<FormInput>` for all form fields
Located at `components/FormInput.tsx`. It wraps `react-native-paper` `TextInput` with MD3 font fixes, stable multiline height, and inline error display.

```tsx
import { FormInput } from '../../components/FormInput';

<FormInput
  label="Field Label *"
  value={value}
  onChange={setValue}      // (v: string) => void
  error={errors.field}     // string | undefined
  keyboard="default"       // keyboardType
  maxLength={100}
  multiline={false}        // true for textarea-style (4-line stable)
  autoCapitalize="none"
  autoCorrect={false}
/>
```

Key behaviors:
- Single-line: fixed `height: 48`, strips newlines on change
- Multiline: stable `4-line` height with internal scroll, `textAlignVertical: top`
- Shows `HelperText type="error"` below field when `error` is set
- Always `mode="outlined"`

### 5.2 `<SmartTextInput>` — auto-growing multiline (lower-level)
Located at `ui/SmartTextInput.tsx`. Use when you need auto-height expansion:
- Grows from `minHeight: 120` up to `maxLines * lineHeight`
- Uses `onContentSizeChange` to measure and expand
- Same MD3 font-metric alignment as `FormInput`

### 5.3 Validation pattern
```tsx
const [errors, setErrors] = React.useState<Record<string, string>>({});

const validate = () => {
  const newErrors: Record<string, string> = {};
  if (!field.trim()) newErrors.field = 'Field is required';
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

// Clear individual error on change:
onChange={t => { setValue(t); setErrors(p => ({ ...p, field: '' })); }}
```

---

## 6. Save / Submit Conventions

### 6.1 FAB for save on form screens
All form screens (Tenant, Room, Payment, Setting) use a FAB:
```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();
const [keyboardHeight, setKeyboardHeight] = React.useState(0);
const fabBottom = 50 + Math.max(0, keyboardHeight - insets.bottom);

<FAB
  icon="content-save"
  style={[styles.fab, { bottom: fabBottom }]}
  loading={saving}
  onPress={handleSave}
  disabled={saving}
/>

// styles:
fab: { position: 'absolute', right: 16 }
```

Keyboard detection for FAB positioning:
```tsx
React.useEffect(() => {
  const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
  const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
  const subShow = Keyboard.addListener(showEvent as any, e => setKeyboardHeight(e?.endCoordinates?.height ?? 0));
  const subHide = Keyboard.addListener(hideEvent as any, () => setKeyboardHeight(0));
  return () => { subShow.remove(); subHide.remove(); };
}, []);
```

### 6.2 Contained Button for inline save (non-FAB screens)
Used on simpler screens (ChangePassword, AddTicket, AuthStack):
```tsx
<Button
  mode="contained"
  onPress={() => void onSave()}
  loading={saving}
  disabled={saving}
>
  Save / Submit
</Button>
```

### 6.3 Upsert pattern (insert or update)
```tsx
if (recordId) {
  result = await supabase.from('table').update(payload).eq('id', recordId).eq('user_id', userId).select().maybeSingle();
} else {
  result = await supabase.from('table').insert(payload).select().maybeSingle();
}
```

### 6.4 Disable form during save
```tsx
<View pointerEvents={saving ? 'none' : 'auto'} style={saving ? styles.formDisabled : undefined}>
  {/* form fields */}
</View>

// styles:
formDisabled: { opacity: 0.6 }
```

---

## 7. Data Fetching Conventions

### 7.1 `useFocusEffect` for screen-level data loads
Screens reload data every time the screen receives focus (not just mount):
```tsx
import { useFocusEffect } from '@react-navigation/native';

useFocusEffect(
  React.useCallback(() => {
    fetchData();
  }, [fetchData]),
);
```

### 7.2 Async fetch function pattern with cancellation guard
```tsx
const fetchData = React.useCallback(async () => {
  let active = true;
  try {
    setInitialLoading(true);
    const { data, error } = await supabase.from('table').select('*').eq('user_id', userId);
    if (!active) return;
    if (error) throw error;
    // set state from data
  } catch (err: any) {
    Alert.alert('Load Failed', err.message || 'Could not load data');
  } finally {
    setInitialLoading(false);
  }
  return () => { active = false; };
}, []);
```

### 7.3 Loading state display
```tsx
if (initialLoading) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" />
    </View>
  );
}
// styles:
loader: { flex: 1, justifyContent: 'center', alignItems: 'center' }
```

### 7.4 React Query for shared/cached data
The global `QueryClient` is configured with:
- `staleTime: 30 * 1000` (30 seconds)
- `gcTime: 10 * 60 * 1000` (10 minutes)
- `retry: 1`

After any mutation, invalidate the relevant query:
```tsx
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ['queryKeyName'] });
```

Common query keys in use:
| Key | Data |
|---|---|
| `['latestSetting']` | Property settings |
| `['signedUrl', bucket, filePath, expiresInSec]` | Cached Supabase Storage URLs |

---

## 8. Caching Conventions

### 8.1 Signed URL caching via `getSignedUrlCached`
Located at `service/signedUrlCache.ts`. Use instead of calling Supabase Storage directly:
```tsx
import { getSignedUrlCached } from '../../service/signedUrlCache';

const url = await getSignedUrlCached(queryClient, rawStorageUrl, {
  bucket: 'tenant-manager',   // optional, default is 'tenant-manager'
  expiresInSec: 3600,         // optional, default 1 hour
});
```
- Caches with `staleTime = expiresInSec - 5 min` (5-minute buffer before expiry)
- `gcTime = max(staleTime, 10 min)`

### 8.2 Storage bucket
All user uploads go to the `tenant-manager` bucket in Supabase Storage.

---

## 9. Navigation Conventions

### 9.1 Stack structure
```
RootStack
├── AuthStack       → AuthScreen → LoginScreen → RegisterScreen
├── MainTabs        → Dashboard | Tenant | Rooms | Payments | Settings
└── MenuTabs        → MenuHome | MenuProfile | MenuChangePassword | MenuSupport
```

### 9.2 Type-safe navigation
All stack param lists are defined in `navigation/StackParam.tsx`:
```tsx
import { AuthStackParamList, RootStackParamList, TenantStackParamList } from '../../navigation/StackParam';

type MyNav = NativeStackNavigationProp<TenantStackParamList, 'TenantList'>;
const navigation = useNavigation<MyNav>();
```

### 9.3 Navigation options — no default header on MainTabs
```tsx
screenOptions={{ headerShown: false }}
```
Custom back/menu buttons are provided via `navigation/TopBackButton.tsx` and `navigation/TopMenuButton.tsx`.

### 9.4 Tab bar styling
```tsx
tabBarStyle: {
  paddingTop: 8,
  paddingBottom: isAndroid ? 10 + insets.bottom : 20,
  height: isAndroid ? 68 + insets.bottom : 85,
  backgroundColor: theme.colors.background,
}
tabBarActiveTintColor: theme.colors.primary
tabBarInactiveTintColor: theme.colors.onSurfaceVariant
```

### 9.5 Analytics screen tracking
Screens are tracked via `trackScreen()` on tab focus:
```tsx
screenListeners={{
  focus: e => {
    const routeName = e.target?.split('-')?.shift();
    if (routeName) trackScreen(`Tab_${routeName}`);
  },
}}
```

---

## 10. Analytics Conventions

Use `trackEvent` (wrapper around Firebase):
```tsx
import { trackEvent } from '../../service/analyticsTracker';

trackEvent('EventName_Action', {
  source: 'ScreenName',
  entity_id: id,
});
```

Event naming convention: `Domain_Action` e.g. `Auth_Login_Success`, `Tenant_Saved`, `Room_Deleted`.

---

## 11. Service Layer Conventions

### 11.1 One service file per domain
| File | Responsibility |
|---|---|
| `tenantService.ts` | CRUD for tenants + photo uploads |
| `RoomService.ts` | CRUD for rooms |
| `TenantRoomService.ts` | Tenant-room assignments, history |
| `BillService.ts` | Billing, meter readings |
| `MeterReadingService.ts` | Electricity meter readings |
| `MenuService.ts` | User profile, tickets, password change |
| `IdentityService.ts` | Registration, Google login |
| `ticketService.ts` | Support ticket creation |
| `authSession.ts` | `getCurrentUserId()`, `getCurrentSessionUser()` |
| `SupabaseClient.ts` | Singleton Supabase client |
| `signedUrlCache.ts` | Signed URL caching utility |
| `analyticsTracker.ts` | Firebase Analytics wrappers |

### 11.2 Always scope queries by `user_id`
Never fetch data across users:
```tsx
const userId = await getCurrentUserId(); // from authSession.ts
supabase.from('table').select('*').eq('user_id', userId)
```

### 11.3 Types defined inside service files
Domain types (`TenantRecord`, `RoomRecord`, `BillRecord`, etc.) are co-located with their service file, not in a separate `types/` directory.

### 11.4 File upload pattern
```tsx
import { readUriAsArrayBuffer } from './readUriAsArrayBuffer';

const arrayBuffer = await readUriAsArrayBuffer(localUri);
const { data, error } = await supabase.storage
  .from('tenant-manager')
  .upload(filePath, arrayBuffer, { upsert: true, contentType: mimeType });
```

---

## 12. Auth & Session

- Auth state changes are observed globally in `AppNavigator.tsx` via `supabase.auth.onAuthStateChange`
- Navigation to `AuthStack` or `MainTabs` is handled automatically by AppNavigator
- `getCurrentUserId()` from `service/authSession.ts` returns the current user's UUID; throw if not logged in

---

## 13. Error Handling

Standard error display:
```tsx
try {
  // ...
} catch (err: any) {
  Alert.alert('Action Failed', err.message || 'Something went wrong');
} finally {
  setLoading(false);
}
```

- Use `Alert.alert(title, message)` for all user-facing errors
- Never expose raw stack traces to users
- Service functions throw errors; screens catch them

---

## 14. Async Event Handlers

Always wrap async `onPress` handlers to avoid unhandled promise rejections (especially on Android):
```tsx
// ✅ Correct
onPress={() => void handleSave()}
// or
onPress={() => handleSave().catch(e => Alert.alert('Error', e.message))}

// ❌ Avoid
onPress={handleSave}   // if handleSave is async
```

---

## 15. Typography Conventions

| Style | fontWeight | fontSize | Color token |
|---|---|---|---|
| Hero title | `'900'` | 16-18 | `theme.colors.onSurface` / `'#111827'` |
| Hero subtitle | `'800'` or `'700'` | 13 | `theme.colors.onSurfaceVariant` / `'#6B7280'` |
| Section title | `'900'` | 16 | `'#111827'` |
| Body / label | `'800'` | 12-14 | `'#6B7280'` |
| Error text | `'800'` | 12 | `theme.colors.error` |
| Button label | `'800'` | 14 | From button props |

---

## 16. Keyboard Handling

Form screens use `KeyboardAvoidingView` or `ScrollView`:
```tsx
<KeyboardAvoidingView
  style={{ flex: 1, backgroundColor: theme.colors.background }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={0}
>
  <ScrollView
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
    automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
    showsVerticalScrollIndicator={false}
  >
    {/* content */}
  </ScrollView>
</KeyboardAvoidingView>
```

---

## 17. Spacing Conventions

| Usage | Value |
|---|---|
| Screen padding | `16` |
| Card padding | `14` |
| Card border radius | `16` (section), `18` (hero) |
| Icon box border radius | `14` |
| Gap between icon and title | `12` |
| Bottom scroll padding | `100` (with FAB), `20–24` (without FAB) |
| Card gap / marginTop | `14` |

---

## 18. Platform Differences

Code explicitly branches for iOS vs Android in:
- `KeyboardAvoidingView behavior`
- `Keyboard` event names (`keyboardWillShow` vs `keyboardDidShow`)
- Tab bar height and bottom padding (`insets.bottom`)
- Google Sign-In: iOS uses Supabase PKCE OAuth flow; Android uses native `GoogleSignin` → `signInWithIdToken`

---

## 19. Environment Variables

Managed via `react-native-config` and `.env`:

| Key | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_PROJECT_ID` | Project reference ID |
| `GOOGLE_WEB_CLIENT_ID` | Google OAuth web client ID |

Access in code:
```tsx
import Config from 'react-native-config';
const url = Config.SUPABASE_URL;
```

---

## 20. Checklist for New Screens

- [ ] Screen wraps content in `ScrollView` with `paddingBottom: 100` (FAB) or `24`
- [ ] Screen background: `backgroundColor: '#F4F6FA'` or `theme.colors.background`
- [ ] Hero `Surface` at top with icon + title + subtitle
- [ ] Each form group in its own `Surface` card with `sectionTitleRow`
- [ ] Form fields use `<FormInput>`
- [ ] Validation via inline `errors` state object
- [ ] Save action uses FAB (`icon="content-save"`) or `Button mode="contained"`
- [ ] `handleSave` uses upsert pattern, calls `queryClient.invalidateQueries` after saving
- [ ] Data fetch in `useFocusEffect` with `active` cancellation guard
- [ ] Analytics events tracked with `trackEvent('Domain_Action', { source: 'ScreenName' })`
- [ ] Error handling via `Alert.alert`
- [ ] All async `onPress` handlers use `void fn()` pattern
- [ ] Navigation types imported from `navigation/StackParam.tsx`
- [ ] Screen name added to `StackParam.tsx` and the relevant stack navigator
