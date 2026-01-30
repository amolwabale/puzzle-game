
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import PaymentScreen from '../screen/Payment/PaymentScreen';
import PaymentFormScreen from '../screen/Payment/PaymentFormScreen';
import PaymentViewScreen from '../screen/Payment/PaymentViewScreen';
import { PaymentStackParamList } from './StackParam';

const Stack = createNativeStackNavigator<PaymentStackParamList>();

export default function PaymentsStack() {
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
        name="PaymentList"
        component={PaymentScreen}
        options={{ title: 'Payments' }}
      />
      <Stack.Screen
        name="PaymentView"
        component={PaymentViewScreen}
        options={{
          title: 'Payment Details',
          headerBackTitle: 'Payments',
        }}
      />
      <Stack.Screen
        name="PaymentForm"
        component={PaymentFormScreen}
        options={({ route }: any) => ({
          title: route?.params?.billId ? 'Edit Payment' : 'Add Payment',
          headerBackTitle: 'Payments',
        })}
      />
    </Stack.Navigator>
  );
}

