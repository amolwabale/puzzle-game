import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, View } from 'react-native';
import { ActivityIndicator, Icon, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProfileScreen from '../screen/Menu/ProfileScreen';
import ChangePasswordScreen from '../screen/Menu/ChangePasswordScreen';
import SupportStack from './SupportStack';
import { TopMenuButton } from './TopMenuButton.tsx';
import { trackScreen } from '../service/analyticsTracker.ts';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MenuHomeExitScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();

  useFocusEffect(
    React.useCallback(() => {
      // Replace the whole MenuTabs stack with MainTabs, selecting Dashboard tab.
      const parent = navigation.getParent();
      parent?.dispatch(
        StackActions.replace('MainTabs', { screen: 'Dashboard' }),
      );
    }, [navigation]),
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
      <Text
        style={{
          marginTop: 10,
          color: theme.colors.onSurfaceVariant,
          fontWeight: '800',
        }}
      >
        Going home…
      </Text>
    </View>
  );
}

function MenuProfileStack() {
  const theme = useTheme();
  const baseHeader = {
    headerTitleAlign: 'left' as const,
    headerStyle: { backgroundColor: theme.colors.background },
    headerTitleStyle: { fontWeight: '700' as const },
    headerTintColor: theme.colors.primary,
    headerRight: () => <TopMenuButton />,
  };

  return (
    <Stack.Navigator screenOptions={baseHeader}>
      <Stack.Screen
        name="MenuProfileScreen"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
    </Stack.Navigator>
  );
}

function MenuChangePasswordStack() {
  const theme = useTheme();
  const baseHeader = {
    headerTitleAlign: 'left' as const,
    headerStyle: { backgroundColor: theme.colors.background },
    headerTitleStyle: { fontWeight: '700' as const },
    headerTintColor: theme.colors.primary,
    headerRight: () => <TopMenuButton />,
  };

  return (
    <Stack.Navigator screenOptions={baseHeader}>
      <Stack.Screen
        name="MenuChangePasswordScreen"
        component={ChangePasswordScreen}
        options={{
          title: 'Change password',
        }}
      />
    </Stack.Navigator>
  );
}

function MenuSupportStack() {
  return <SupportStack />;
}

export default function MenuTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';

  return (
    <Tab.Navigator
      screenOptions={{
        // Match MainTabs: hide the tab header and rely on native-stack headers
        // so height/padding matches Home and the rest of the app.
        headerShown: false,
        // WhatsApp-like composer behavior: avoid tab bar + keyboard overlap.
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          paddingTop: 8,
          // Add safe-area inset so the app tab bar never sits under Android system navigation.
          // iOS already accounts for the home indicator; don't double-apply insets.
          paddingBottom: 10 + (isAndroid ? insets.bottom : 0),
          height: 78 + (isAndroid ? insets.bottom : 0),
          backgroundColor: theme.colors.background,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
      }}
      screenListeners={{
        focus: e => {
          const routeName = e.target?.split('-')?.shift();

          if (routeName) {
            trackScreen(`Tab_${routeName}`);
          }
        },
      }}
    >
      <Tab.Screen
        name="MenuHome"
        component={MenuHomeExitScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Icon source="home" color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="MenuProfile"
        component={MenuProfileStack}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon source="account-circle-outline" color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="MenuChangePassword"
        component={MenuChangePasswordStack}
        options={{
          tabBarLabel: 'Password',
          tabBarIcon: ({ color, size }) => (
            <Icon source="lock-reset" color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="MenuSupport"
        component={MenuSupportStack}
        options={{
          tabBarLabel: 'Support',
          tabBarIcon: ({ color, size }) => (
            <Icon source="lifebuoy" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
