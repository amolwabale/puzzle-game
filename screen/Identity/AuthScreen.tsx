import * as React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text, Surface, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/StackParam';

type NavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'RegisterScreen',
  'LoginScreen'
>;

export default function AuthScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const handleLogin = () => {
    navigation.navigate('LoginScreen');
  };

  const handleRegister = () => {
    navigation.navigate('RegisterScreen');
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.card} elevation={4}>
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: theme.colors.primary }]}
        >
          Tenant Manager
        </Text>

        <Text variant="bodyMedium" style={styles.subtitle}>
          Manage rentals, tenants, and payments with ease
        </Text>

        <Button
          mode="contained"
          onPress={handleLogin}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Login
        </Button>

        <Button
          mode="outlined"
          onPress={handleRegister}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Register
        </Button>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    padding: 28,
    borderRadius: 16,
    alignItems: 'center',
  },
  title: {
    marginBottom: 8,
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
  },
  button: {
    width: '100%',
    marginBottom: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});
