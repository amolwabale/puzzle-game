import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RegisterScreen from '../screen/Identity/RegisterScreen';
import { AuthStackParamList } from './StackParam';
import AuthScreen from '../screen/Identity/AuthScreen';
import LoginScreen from '../screen/Identity/LoginScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AuthScreen"
        component={AuthScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LoginScreen"
        component={LoginScreen}
        options={{
          // Show header bar but keep it text-free and without a back button.
          headerTitle: 'Login',
          headerBackTitle: '',
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="RegisterScreen"
        component={RegisterScreen}
        options={{
          // Show header bar but keep it text-free and without a back button.
          headerTitle: 'Register',
          headerBackTitle: '',
          headerBackVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}
