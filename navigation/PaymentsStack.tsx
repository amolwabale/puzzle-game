import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import PaymentScreen from '../screen/Payment/PaymentScreen';
import PaymentFormScreen from '../screen/Payment/PaymentFormScreen';
import PaymentViewScreen from '../screen/Payment/PaymentViewScreen';
import { PaymentStackParamList } from './StackParam';
import { TopMenuButton } from './TopMenuButton.tsx';
import { TopBackButton } from './TopBackButton';

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
    <Stack.Navigator
      screenOptions={({ navigation, route }) => {
        const showBack = route.name !== 'PaymentList';
        return {
          ...baseHeader,
          headerBackVisible: false,
          headerBackTitleVisible: false,
          headerLeft: () =>
            showBack ? (
              <TopBackButton
                label="Payments"
                onPress={() => navigation.goBack()}
              />
            ) : null,
        };
      }}
    >
      <Stack.Screen
        name="PaymentList"
        component={PaymentScreen}
        options={{
          title: 'Payments',
        }}
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
