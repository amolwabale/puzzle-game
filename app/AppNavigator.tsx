import React from 'react';
import { View } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, useTheme } from 'react-native-paper';

import MainTabs from '../navigation/MainTabs';
import AuthStack from '../navigation/AuthStack';
import { RootStackParamList } from '../navigation/StackParam';
import supabase from '../service/SupabaseClient';
import { TopMenuProvider } from '../navigation/TopMenuDrawer';
import ProfileScreen from '../screen/Menu/ProfileScreen';
import ChangePasswordScreen from '../screen/Menu/ChangePasswordScreen';
import SupportScreen from '../screen/Menu/SupportScreen';
import { TopMenuButton } from '../navigation/TopMenuButton.tsx';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const theme = useTheme();
  const navRef = useNavigationContainerRef();
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<any>(null);

  React.useEffect(() => {
    // 1️⃣ Restore session on app start
    supabase.auth.getSession().then(({ data, error }) => {
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
      <NavigationContainer ref={navRef} theme={NavigationDefaultTheme}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <>
              {/* ✅ User logged in → Main app */}
              <RootStack.Screen name="MainTabs" component={MainTabs} />

              {/* Global menu destinations (presented on top of tabs) */}
              <RootStack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                  headerShown: true,
                  title: 'Profile',
                  headerTitleAlign: 'left',
                  headerStyle: { backgroundColor: theme.colors.background },
                  headerTintColor: theme.colors.primary,
                  headerRight: () => <TopMenuButton />,
                }}
              />
              <RootStack.Screen
                name="ChangePassword"
                component={ChangePasswordScreen}
                options={{
                  headerShown: true,
                  title: 'Change password',
                  headerTitleAlign: 'left',
                  headerStyle: { backgroundColor: theme.colors.background },
                  headerTintColor: theme.colors.primary,
                  headerRight: () => <TopMenuButton />,
                }}
              />
              <RootStack.Screen
                name="Support"
                component={SupportScreen}
                options={{
                  headerShown: true,
                  title: 'Support',
                  headerTitleAlign: 'left',
                  headerStyle: { backgroundColor: theme.colors.background },
                  headerTintColor: theme.colors.primary,
                  headerRight: () => <TopMenuButton />,
                }}
              />
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
