import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator } from 'react-native-paper';

import MainTabs from '../navigation/MainTabs';
import AuthStack from '../navigation/AuthStack';
import { RootStackParamList } from '../navigation/StackParam';
import supabase from '../service/SupabaseClient';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
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
    <NavigationContainer theme={NavigationDefaultTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          // ✅ User logged in → Main app
          <RootStack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          // ❌ Not logged in → Auth screens only
          <RootStack.Screen name="AuthStack" component={AuthStack} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
