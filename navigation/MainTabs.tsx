import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

import DashboardStack from './DashboardStack';
import TenantStack from './TenantStack';
import { RoomStack } from './RoomStack';
import PaymentsStack from './PaymentsStack';
import SettingsStack from './SettingsStack';
import { trackScreen } from '../service/analyticsTracker.ts';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // WhatsApp-like composer behavior: avoid tab bar + keyboard overlap.
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          paddingTop: 8,
          // Add safe-area inset so the app tab bar never sits under Android system navigation.
          // iOS already accounts for the home indicator; don't double-apply insets.
          paddingBottom: 10 + (isAndroid ? insets.bottom : 0),
          height: 68 + (isAndroid ? insets.bottom : 0),
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
        name="Dashboard"
        component={DashboardStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Icon source="home" color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Tenant"
        component={TenantStack}
        options={{
          tabBarLabel: 'Tenants',
          tabBarIcon: ({ color, size }) => (
            <Icon source="account-group" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Rooms"
        component={RoomStack}
        options={{
          tabBarLabel: 'Rooms',
          tabBarIcon: ({ color, size }) => (
            <Icon source="home-city-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsStack}
        options={{
          tabBarLabel: 'Payments',
          tabBarIcon: ({ color, size }) => (
            <Icon source="credit-card-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStack}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Icon source="cog-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
