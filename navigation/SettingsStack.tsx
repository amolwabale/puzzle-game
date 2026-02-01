import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import SettingScreen from '../screen/Setting/SettingScreen';
import { TopMenuButton } from './TopMenuButton.tsx';

const Stack = createNativeStackNavigator();

export default function SettingsStack() {
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
        name="SettingScreen"
        component={SettingScreen}
        options={{
          title: 'Settings',
        }}
      />
    </Stack.Navigator>
  );
}
