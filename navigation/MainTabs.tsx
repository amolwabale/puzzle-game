import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, useTheme } from 'react-native-paper';

import DashboardStack from './DashboardStack';
import TenantStack from './TenantStack';
import { RoomStack } from './RoomStack';
import PaymentsStack from './PaymentsStack';
import SettingsStack from './SettingsStack';
import { trackScreen } from '../service/analyticsTracker.ts';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // WhatsApp-like composer behavior: avoid tab bar + keyboard overlap.
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: 10,
          height: 78,
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
