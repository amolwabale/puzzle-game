
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import RoomScreen from '../screen/Room/RoomScreen';
import RoomFormScreen from '../screen/Room/RoomFormScreen';
import { RoomStackParamList } from './StackParam';
import RoomViewScreen from '../screen/Room/RoomViewScreen';


const Stack = createNativeStackNavigator<RoomStackParamList>();

export function RoomStack() {
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
        name="RoomList"
        component={RoomScreen}
        options={{ title: 'Rooms' }}
      />
      <Stack.Screen
        name="RoomForm"
        component={RoomFormScreen}
        options={({ route }) => ({
          title: route.params?.mode === 'edit' ? 'Edit Room' : 'Add Room',
          headerBackTitle: 'Rooms',
        })}
      />
      <Stack.Screen
        name="RoomView"
        component={RoomViewScreen}
        options={{
          title: 'Room Details',
          headerBackTitle: 'Rooms',
        }}
      />
    </Stack.Navigator>
  );
}

