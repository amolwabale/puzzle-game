
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import DashboardScreen from '../screen/Dashboard/DashboardScreen';

const Stack = createNativeStackNavigator();

export default function DashboardStack() {
  const theme = useTheme();
  const baseHeader = {
    headerTitleAlign: 'left' as const,
    headerStyle: { backgroundColor: theme.colors.background },
    headerTitleStyle: { fontWeight: '700' as const },
    headerTintColor: theme.colors.primary,
  };

  return (
    <Stack.Navigator screenOptions={baseHeader}>
      <Stack.Screen
        name="DashboardScreen"
        component={DashboardScreen}
        options={{ title: 'Home' }}
      />
    </Stack.Navigator>
  );
}
