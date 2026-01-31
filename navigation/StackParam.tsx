export type AuthStackParamList = {
  AuthScreen: undefined;
  LoginScreen: undefined;
  RegisterScreen: undefined;
};

export type RootStackParamList = {
  AuthStack: undefined;
  MainTabs: undefined;
  MenuTabs: { screen?: 'MenuHome' | 'MenuProfile' | 'MenuChangePassword' | 'MenuSupport' } | undefined;
};

export type TenantStackParamList = {
  TenantList: undefined;
  TenantView: { tenantId: number };
  TenantForm: { tenantId?: number; mode: 'add' | 'edit' };
  TenantDocument: { title: string; url: string };
};

export type RoomStackParamList = {
  RoomList: undefined;
  RoomView: { roomId: number; };
  RoomForm: { mode: 'add' | 'edit'; roomId?: number };
};

export type PaymentStackParamList = {
  PaymentList: undefined;
  PaymentView: { billId: number; openRecordPayment?: boolean };
  PaymentForm: { billId?: number } | undefined;
};
