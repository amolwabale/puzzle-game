
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { TenantStackParamList } from './StackParam';
import TenantScreen from '../screen/Tenant/TenantScreen.tsx';
import TenantFormScreen from '../screen/Tenant/TenantFormScreen.tsx';
import TenantViewScreen from '../screen/Tenant/TenantViewScreen.tsx';
import TenantDocumentViewScreen from '../screen/Tenant/TenantDocumentViewScreen.tsx';
import { HeaderTitle } from './HeaderTitle';
import { TopMenuButton } from './TopMenuButton.tsx';

const Stack = createNativeStackNavigator<TenantStackParamList>();

export default function TenantStack() {
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
        name="TenantList"
        component={TenantScreen}
        options={{
          title: 'Tenants',
          headerTitle: () => <HeaderTitle icon="account-group" title="Tenants" />,
        }}
      />
      <Stack.Screen
        name="TenantForm"
        component={TenantFormScreen}
        options={({ route }) => ({
          title: route.params?.mode === 'edit' ? 'Edit Tenant' : 'Add Tenant',
          headerTitle: () => (
            <HeaderTitle
              icon={route.params?.mode === 'edit' ? 'account-edit-outline' : 'account-plus-outline'}
              title={route.params?.mode === 'edit' ? 'Edit Tenant' : 'Add Tenant'}
            />
          ),
          headerBackTitle: 'Tenants',
        })}
      />
      <Stack.Screen
        name="TenantView"
        component={TenantViewScreen}
        options={{
          title: 'Tenant Details',
          headerTitle: () => <HeaderTitle icon="account-outline" title="Tenant Details" />,
          headerBackTitle: 'Tenants',
        }}
      />
      <Stack.Screen
        name="TenantDocument"
        component={TenantDocumentViewScreen}
        options={({ route }) => ({
          title: route.params?.title || 'Document',
          headerTitle: () => <HeaderTitle icon="file-document-outline" title={route.params?.title || 'Document'} />,
          headerBackTitle: 'Tenant',
        })}
      />
    </Stack.Navigator>
  );
}

