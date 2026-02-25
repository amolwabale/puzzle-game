import React from 'react';
import { View, Linking, Platform } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import BootSplash from 'react-native-bootsplash';
import { getApp } from '@react-native-firebase/app';
import { getPerformance, trace } from '@react-native-firebase/perf';
import {
  getCrashlytics,
  setUserId as setCrashlyticsUserId,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';
import { getAnalytics, setUserId } from '@react-native-firebase/analytics';

import MainTabs from '../navigation/MainTabs';
import MenuTabs from '../navigation/MenuTabs';
import AuthStack from '../navigation/AuthStack';
import { RootStackParamList } from '../navigation/StackParam';
import supabase from '../service/SupabaseClient';
import { TopMenuProvider } from '../navigation/TopMenuDrawer';
import { TopMenuButton } from '../navigation/TopMenuButton.tsx';
import { trackEvent } from '../service/analyticsTracker';
import { checkForUpdate, getStoreUrl } from '../service/updateService';
import { HardUpdateModal } from '../components/HardUpdateModal';
import { initCacheForUser } from '../service/cacheService';
const RootStack = createNativeStackNavigator<RootStackParamList>();

function getDeepActiveRouteName(state: any): string | undefined {
  if (!state?.routes?.length) return undefined;
  const route = state.routes[state.index ?? 0];
  if (!route) return undefined;
  if (route.state) return getDeepActiveRouteName(route.state);
  return route.name;
}

export default function AppNavigator() {
  const theme = useTheme();
  const navRef = useNavigationContainerRef();
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<any>(null);
  const analyticsInstance = getAnalytics(getApp());

  // Hard Update State
  const [hardUpdateState, setHardUpdateState] = React.useState<{
    isVisible: boolean;
    isForceUpdate: boolean;
    message: string;
    storeUrl: string;
  }>({
    isVisible: false,
    isForceUpdate: false,
    message: '',
    storeUrl: '',
  });

  const lastRouteNameRef = React.useRef<string | undefined>(undefined);
  const screenTraceRef = React.useRef<any>(null);
  const screenTraceIdRef = React.useRef(0);

  const startScreenTrace = React.useCallback(async (routeName?: string) => {
    if (!routeName) return;
    try {
      // Stop any previous in-flight trace (safety).
      try {
        screenTraceRef.current?.stop?.();
      } catch {}

      const traceName = `screen_${routeName}_load`;
      const perfTrace = trace(getPerformance(getApp()), traceName);
      await perfTrace.start();
      const myId = ++screenTraceIdRef.current;
      screenTraceRef.current = perfTrace;

      // Stop after the screen has had a chance to commit & paint.
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          if (screenTraceIdRef.current !== myId) return;
          try {
            await perfTrace.stop?.();
          } finally {
            if (screenTraceRef.current === perfTrace) screenTraceRef.current = null;
          }
        });
      });
    } catch {
      // Perf must never break app flow.
    }
  }, []);

  /**
   * Parse deep link URL to extract tokens
   * Link format: tenantmanager://reset-password?access_token=...&refresh_token=...
   */
  const parseResetPasswordDeepLink = React.useCallback(
    (url: string): { accessToken?: string; refreshToken?: string; code?: string } => {
      console.log('[DeepLink] Parsing URL:', url);

      let accessToken: string | undefined;
      let refreshToken: string | undefined;
      let code: string | undefined;

      try {
        // Split by ? to get query string
        const parts = url.split('?');
        let paramsStr = '';

        if (parts.length > 1) {
          paramsStr = parts[1];
        } else if (url.includes('#')) {
          // Try hash fragment
          const hashParts = url.split('#');
          if (hashParts.length > 1) {
            paramsStr = hashParts[1];
          }
        }

        console.log('[DeepLink] Params string:', paramsStr);

        // Parse parameters manually
        if (paramsStr) {
          const paramPairs = paramsStr.split('&');
          for (const pair of paramPairs) {
            const [key, value] = pair.split('=');
            if (!key) continue;

            const decodedValue = value ? decodeURIComponent(value) : '';
            console.log('[DeepLink] Parsed param:', key, '=', decodedValue.substring(0, 20) + '...');

            if (key === 'access_token') {
              accessToken = decodedValue;
            } else if (key === 'refresh_token') {
              refreshToken = decodedValue;
            } else if (key === 'code') {
              code = decodedValue;
            }
          }
        }

        console.log('[DeepLink] Extracted:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasCode: !!code,
        });
      } catch (err) {
        console.error('[DeepLink] Error parsing:', err);
      }

      return { accessToken, refreshToken, code };
    },
    [],
  );

  /**
   * Handle deep link for password reset
   */
  const handleResetPasswordDeepLink = React.useCallback(
    async (url: string) => {
      try {
        console.log('[DeepLink] Handling:', url);

        const { accessToken, refreshToken, code } = parseResetPasswordDeepLink(url);

        // 🔐 IMPORTANT: Don't set session immediately!
        // Instead, navigate to SetNewPasswordScreen which will handle it.
        // This ensures the screen appears while user is still in AuthStack.

        if (accessToken && refreshToken) {
          console.log('[DeepLink] Navigating with tokens');
          // Navigate to SetNewPasswordScreen with tokens
          // Use a small delay to ensure navigation is ready
          setTimeout(() => {
            try {
              (navRef.current?.navigate as any)('SetNewPasswordScreen', {
                accessToken,
                refreshToken,
              });
            } catch (err) {
              console.error('[DeepLink] Navigation failed:', err);
            }
          }, 300);

          trackEvent('Auth_ResetPasswordDeepLink_Detected', {
            hasTokens: true,
          });
          return;
        } else if (code) {
          console.log('[DeepLink] Navigating with code');
          // Alternative: Code-based flow
          setTimeout(() => {
            try {
              (navRef.current?.navigate as any)('SetNewPasswordScreen', {
                code,
              });
            } catch (err) {
              console.error('[DeepLink] Navigation failed:', err);
            }
          }, 300);

          trackEvent('Auth_ResetPasswordDeepLink_Detected', {
            hasCode: true,
          });
          return;
        }

        console.warn('[DeepLink] No tokens/code found in URL');
        trackEvent('Auth_ResetPasswordDeepLink_Invalid', {});
      } catch (err: any) {
        console.error('[DeepLink] Error handling:', err);
        trackEvent('Auth_ResetPasswordDeepLink_Unexpected', {
          error: err?.message,
        });
      }
    },
    [navRef, parseResetPasswordDeepLink],
  );

  React.useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        // 1️⃣ Restore session on app start
        const { data, error } = await supabase.auth.getSession();
        
        if (isMounted) {
          await initCacheForUser(data.session?.user?.id ?? null);

          if (data.session) {
            trackEvent('App_Started', {
              source: 'App',
            });
            if (data.session.user.id) {
              setUserId(analyticsInstance, data.session.user.id);
              try {
                setCrashlyticsUserId(getCrashlytics(), String(data.session.user.id));
              } catch {}
            }
            // Enable Crashlytics collection at runtime (RNFB Core config may disable by default).
            try {
              setCrashlyticsCollectionEnabled(getCrashlytics(), true);
            } catch {}
          }
          if (!error) {
            setSession(data.session);
          }

          // 2️⃣ Check for hard update (runs after session is restored)
          console.log('[AppNavigator] Checking for hard update...');
          const updateResult = await checkForUpdate();

          if (isMounted) {
            if (updateResult.status === 'force' || updateResult.status === 'optional') {
              console.log('[AppNavigator] Update available:', updateResult.status);
              trackEvent('HardUpdate_Available', {
                status: updateResult.status,
                currentVersion: updateResult.currentVersion,
                newVersion: updateResult.latestVersion,
              });

              setHardUpdateState({
                isVisible: true,
                isForceUpdate: updateResult.status === 'force',
                message: updateResult.updateMessage,
                storeUrl: getStoreUrl(Platform.OS as 'ios' | 'android'),
              });
            } else {
              console.log('[AppNavigator] App is up to date');
            }
          }
        }
      } catch (err) {
        console.error('[AppNavigator] Error initializing app:', err);
        if (isMounted) {
          setLoading(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeApp();

    // 3️⃣ Listen to auth state changes (login / logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (isMounted) {
          setSession(session);
          void initCacheForUser(session?.user?.id ?? null);
        }
      },
    );

    // 4️⃣ Handle runtime deep links (app already running)
    const deepLinkSubscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[DeepLink] URL event:', url);
      if (url.includes('reset-password') || url.includes('access_token')) {
        handleResetPasswordDeepLink(url).catch((err) => {
          console.error('[DeepLink] Failed to process:', err);
        });
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      deepLinkSubscription.remove();
    };
  }, [handleResetPasswordDeepLink]);

  // 3️⃣ Splash / loader while checking auth
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <TopMenuProvider navigationRef={navRef as any}>
      <NavigationContainer
        ref={navRef}
        theme={NavigationDefaultTheme}
        linking={{
          /**
           * 🔐 Deep Link Configuration for Password Reset
           *
           * Supabase sends reset emails with links like:
           * https://example.com/auth/callback?access_token=...&refresh_token=...
           *
           * We also support custom deep link scheme:
           * tenantmanager://reset-password?access_token=...&refresh_token=...
           *
           * CRITICAL: React Navigation's built-in config only works for known patterns.
           * For password reset, we use onDeepLink to handle arbitrary parameters.
           */
          prefixes: ['tenantmanager://', 'https://example.com/auth'],
          config: {
            screens: {
              AuthStack: {
                screens: {
                  SetNewPasswordScreen: 'reset-password',
                },
              },
            },
          },
          /**
           * Called when the app is launched from a deep link and hasn't set up navigation yet.
           * This handles password reset links that arrive before the app is ready.
           * Returns the initial deep link URL if present.
           */
          async getInitialURL() {
            // Check if the app was launched from a deep link
            const url = await Linking.getInitialURL();

            if (url != null) {
              console.log('[DeepLink] Initial URL from Linking:', url);
              return url;
            }
            // Otherwise, return undefined - app will go to normal start screen
            return undefined;
          },
        }}
        onReady={() => {
          console.log('[Navigation] onReady');
          // Hide native splash once navigation is mounted.
          void BootSplash.hide({ fade: true });
          const initial = getDeepActiveRouteName(navRef.getRootState?.());
          lastRouteNameRef.current = initial;
          void startScreenTrace(initial);
        }}
        onStateChange={(state) => {
          const current = getDeepActiveRouteName(state);
          const prev = lastRouteNameRef.current;
          if (current && current !== prev) {
            console.log('[Navigation] Screen changed:', prev, '->', current);
            lastRouteNameRef.current = current;
            void startScreenTrace(current);
          }
        }}
      >
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <>
              {/* ✅ User logged in → Main app */}
              <RootStack.Screen name="MainTabs" component={MainTabs} />

              {/* Menu area with its own bottom navigation */}
              <RootStack.Screen name="MenuTabs" component={MenuTabs} />
            </>
          ) : (
            // ❌ Not logged in → Auth screens only
            <RootStack.Screen name="AuthStack" component={AuthStack} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>

      {/* Hard Update Modal - shown when app needs update */}
      <HardUpdateModal
        visible={hardUpdateState.isVisible}
        isForceUpdate={hardUpdateState.isForceUpdate}
        message={hardUpdateState.message}
        storeUrl={hardUpdateState.storeUrl}
        onOptionalDismiss={() => {
          setHardUpdateState((prev) => ({
            ...prev,
            isVisible: false,
          }));
        }}
      />
    </TopMenuProvider>
  );
}
