
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import PaymentScreen from '../screen/Payment/PaymentScreen';
import PaymentFormScreen from '../screen/Payment/PaymentFormScreen';
import PaymentViewScreen from '../screen/Payment/PaymentViewScreen';
import { PaymentStackParamList } from './StackParam';
import { HeaderTitle } from './HeaderTitle';
import { TopMenuButton } from './TopMenuButton.tsx';

const Stack = createNativeStackNavigator<PaymentStackParamList>();

export default function PaymentsStack() {
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
        name="PaymentList"
        component={PaymentScreen}
        options={{
          title: 'Payments',
          headerTitle: () => <HeaderTitle icon="cash-multiple" title="Payments" />,
        }}
      />
      <Stack.Screen
        name="PaymentView"
        component={PaymentViewScreen}
        options={{
          title: 'Payment Details',
          headerTitle: () => <HeaderTitle icon="receipt-text-outline" title="Payment Details" />,
          headerBackTitle: 'Payments',
        }}
      />
      <Stack.Screen
        name="PaymentForm"
        component={PaymentFormScreen}
        options={({ route }: any) => ({
          title: route?.params?.billId ? 'Edit Payment' : 'Add Payment',
          headerTitle: () => (
            <HeaderTitle
              icon={route?.params?.billId ? 'pencil-outline' : 'cash-plus'}
              title={route?.params?.billId ? 'Edit Payment' : 'Add Payment'}
            />
          ),
          headerBackTitle: 'Payments',
        })}
      />
    </Stack.Navigator>
  );
}

