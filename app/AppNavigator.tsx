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

import MainTabs from '../navigation/MainTabs';
import MenuTabs from '../navigation/MenuTabs';
import AuthStack from '../navigation/AuthStack';
import { RootStackParamList } from '../navigation/StackParam';
import supabase from '../service/SupabaseClient';
import { TopMenuProvider } from '../navigation/TopMenuDrawer';
import { TopMenuButton } from '../navigation/TopMenuButton.tsx';
import '@react-native-firebase/app';
import analytics from '@react-native-firebase/analytics';
import { getAnalytics, setUserId } from '@react-native-firebase/analytics';
import { trackEvent } from '../service/analyticsTracker';
import { NativeModules } from 'react-native';
const RootStack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const theme = useTheme();
  const navRef = useNavigationContainerRef();
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<any>(null);
  const analyticsInstance = getAnalytics();


  React.useEffect(() => {
    // 1️⃣ Restore session on app start
    supabase.auth.getSession().then(({ data, error }) => {
      if (data.session) {
        trackEvent('App_Started', {
          source: 'App',
        });
        if (data.session.user.id) {
          setUserId(analyticsInstance, data.session.user.id);
        }
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
