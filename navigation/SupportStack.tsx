import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { SupportStackParamList } from './StackParam';
import SupportScreen from '../screen/Menu/SupportScreen';
import AddTicketScreen from '../screen/Support/AddTicketScreen';
import TicketChatScreen from '../screen/Support/TicketChatScreen';
import { TopMenuButton } from './TopMenuButton.tsx';
import { TopBackButton } from './TopBackButton';

const Stack = createNativeStackNavigator<SupportStackParamList>();

export default function SupportStack() {
  const theme = useTheme();
  const baseHeader = {
    headerTitleAlign: 'left' as const,
    headerStyle: { backgroundColor: theme.colors.background },
    headerTitleStyle: { fontWeight: '700' as const },
    headerTintColor: theme.colors.primary,
    headerRight: () => <TopMenuButton />,
  };

  return (
    <Stack.Navigator
      screenOptions={({ navigation, route }) => {
        const showBack = route.name !== 'SupportTicketList';
        return {
          ...baseHeader,
          headerBackVisible: false,
          headerBackTitleVisible: false,
          headerLeft: () =>
            showBack ? <TopBackButton label="Support" onPress={() => navigation.goBack()} /> : null,
        };
      }}
    >
      <Stack.Screen
        name="SupportTicketList"
        component={SupportScreen}
        options={{ title: 'Support' }}
      />
      <Stack.Screen
        name="SupportNewTicket"
        component={AddTicketScreen}
        options={{ title: 'New Ticket' }}
      />
      <Stack.Screen
        name="SupportTicketChat"
        component={TicketChatScreen}
        options={{ title: 'Ticket' }}
      />
    </Stack.Navigator>
  );
}

