import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RegisterScreen from '../screen/Identity/RegisterScreen';
import { AuthStackParamList } from './StackParam';
import AuthScreen from '../screen/Identity/AuthScreen';
import LoginScreen from '../screen/Identity/LoginScreen';
import ForgotPasswordScreen from '../screen/Identity/ForgotPasswordScreen';
import SetNewPasswordScreen from '../screen/Identity/SetNewPasswordScreen';

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
          headerTitle: '',
          headerBackTitle: '',
          headerBackVisible: false,
          headerLeft: () => null,
        }}
      />
      <Stack.Screen
        name="RegisterScreen"
        component={RegisterScreen}
        options={{
          // Show header bar but keep it text-free and without a back button.
          headerTitle: '',
          headerBackTitle: '',
          headerBackVisible: false,
          headerLeft: () => null,
        }}
      />
      <Stack.Screen
        name="ForgotPasswordScreen"
        component={ForgotPasswordScreen}
        options={{
          headerTitle: '',
          headerBackTitle: 'Back',
          headerBackVisible: true,
        }}
      />
      <Stack.Screen
        name="SetNewPasswordScreen"
        component={SetNewPasswordScreen}
        options={{
          headerTitle: '',
          headerBackTitle: '',
          headerBackVisible: false,
          headerLeft: () => null,
        }}
      />
    </Stack.Navigator>
  );
}
