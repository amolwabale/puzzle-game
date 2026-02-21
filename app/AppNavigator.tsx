import React from 'react';
import { View } from 'react-native';
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


  React.useEffect(() => {
    // 1️⃣ Restore session on app start
    supabase.auth.getSession().then(({ data, error }) => {
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
      setLoading(false);
    });

    // 2️⃣ Listen to auth state changes (login / logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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
        onReady={() => {
          // Hide native splash once navigation is mounted.
          void BootSplash.hide({ fade: true });
          const initial = getDeepActiveRouteName(navRef.getRootState?.());
          lastRouteNameRef.current = initial;
          void startScreenTrace(initial);
        }}
        onStateChange={state => {
          const current = getDeepActiveRouteName(state);
          const prev = lastRouteNameRef.current;
          if (current && current !== prev) {
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
    </TopMenuProvider>
  );
}
