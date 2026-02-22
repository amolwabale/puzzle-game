import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  Button,
  Text,
  useTheme,
  Icon,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/StackParam';
import { FormInput } from '../../components/FormInput';
import supabase from '../../service/SupabaseClient';
import { trackEvent } from '../../service/analyticsTracker';

type NavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'SetNewPasswordScreen'
>;

type RouteProp = AuthStackParamList['SetNewPasswordScreen'];

/**
 * SetNewPasswordScreen - Set new password after password reset
 *
 * This screen is shown after user clicks password reset link in email.
 * Deep link handler in AppNavigator extracts auth tokens and passes them here.
 *
 * UX Flow:
 * 1. User clicks reset link in email
 * 2. Deep link: tenantmanager://reset-password?access_token=...&refresh_token=...
 * 3. AppNavigator extracts tokens and navigates here
 * 4. Session is established via setSession()
 * 5. User enters new password and confirms it
 * 6. updateUser() is called to set new password
 * 7. Success → Navigate to LoginScreen
 *
 * Security:
 * ✅ Session already validated (extracted from email reset link)
 * ✅ Secure password update via Supabase
 * ✅ Password requirements validated on client
 * ✅ No password transmitted insecurely
 */
export default function SetNewPasswordScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<any>();

  console.log('[SetNewPasswordScreen] Rendered');

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    password: string;
    confirmPassword: string;
  }>({ password: '', confirmPassword: '' });

  // Extract tokens from deep link params
  const accessToken = route.params?.accessToken;
  const refreshToken = route.params?.refreshToken;
  const code = route.params?.code;

  console.log('[SetNewPasswordScreen] Route params:', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    hasCode: !!code,
    paramsKeys: Object.keys(route.params || {}),
  });

  /**
   * Establish session from tokens passed via deep link
   * This is called once when the screen mounts, after receiving tokens from AppNavigator
   */
  React.useEffect(() => {
    console.log('[SetNewPasswordScreen] useEffect for session init triggered');
    
    const initializeSession = async () => {
      try {
        if (accessToken && refreshToken) {
          console.log('[SetNewPasswordScreen] Establishing session from tokens...');
          // Set session from tokens
          setLoading(true);
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('[SetNewPasswordScreen] Error establishing session:', error);
            Alert.alert(
              'Session Error',
              'Failed to establish your session. Please request a new password reset link.',
            );
            navigation.navigate('ForgotPasswordScreen');
            return;
          }

          console.log('[SetNewPasswordScreen] Session established successfully');
          trackEvent('Auth_SetNewPasswordScreen_SessionEstablished', {
            method: 'tokens',
          });
        } else if (code) {
          console.log('[SetNewPasswordScreen] Exchanging code for session...');
          // Exchange code for session (alternative flow)
          setLoading(true);
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            code,
          );

          if (error) {
            console.error('[SetNewPasswordScreen] Error exchanging code:', error);
            Alert.alert(
              'Code Exchange Error',
              'Failed to process your reset link. Please request a new one.',
            );
            navigation.navigate('ForgotPasswordScreen');
            return;
          }

          console.log('[SetNewPasswordScreen] Code exchanged successfully');
          trackEvent('Auth_SetNewPasswordScreen_SessionEstablished', {
            method: 'code',
          });
        } else {
          // No tokens provided - this shouldn't happen normally
          console.warn('[SetNewPasswordScreen] No tokens/code provided, redirecting to ForgotPasswordScreen');
          Alert.alert(
            'Invalid Request',
            'This screen requires a valid password reset link.',
          );
          navigation.navigate('ForgotPasswordScreen');
        }
      } catch (err: any) {
        console.error('[SetNewPasswordScreen] Error initializing session:', err);
        Alert.alert('Error', 'An unexpected error occurred.');
        navigation.navigate('ForgotPasswordScreen');
      } finally {
        setLoading(false);
      }
    };

    // Only initialize if we have tokens/code
    if (accessToken || refreshToken || code) {
      initializeSession();
    }
  }, [accessToken, refreshToken, code]);

  /**
   * Validate password requirements:
   * - Minimum 6 characters
   * - Passwords match
   */
  const validatePasswords = (): boolean => {
    const newErrors = { password: '', confirmPassword: '' };
    let isValid = true;

    if (!password.trim()) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  /**
   * Update password via Supabase
   * - Session must be already established (from deep link tokens)
   */
  const handleSetNewPassword = async () => {
    if (!validatePasswords()) {
      return;
    }

    try {
      setLoading(true);

      // Verify session still exists
      const { data: sessionData, error: sessionCheckError } =
        await supabase.auth.getSession();
      if (sessionCheckError || !sessionData.session?.user?.id) {
        Alert.alert(
          'Session Expired',
          'Your reset link has expired. Please request a new one.',
        );
        navigation.navigate('ForgotPasswordScreen');
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        console.error('Password update error:', error);
        Alert.alert(
          'Password Update Failed',
          error.message || 'Could not update your password. Please try again.',
        );
        return;
      }

      // Success
      setSuccess(true);
      trackEvent('Auth_PasswordReset_Success', {
        email: sessionData.session.user.email,
      });

      // Auto-navigate after 2 seconds
      setTimeout(() => {
        // Sign out after password reset so user can login with new password
        supabase.auth.signOut().catch(() => undefined);
        navigation.navigate('LoginScreen');
      }, 2000);
    } catch (err: any) {
      console.error('Unexpected error in password update:', err);
      Alert.alert(
        'Error',
        err?.message || 'An unexpected error occurred. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cancel and go back to login
   */
  const handleCancel = () => {
    navigation.navigate('LoginScreen');
    trackEvent('Auth_PasswordReset_Cancelled', {});
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {!success ? (
          <>
            {/* Header Section */}
            <View style={styles.headerSection}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Icon
                  source="lock-outline"
                  size={40}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                Set New Password
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Create a strong password for your account
              </Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              {/* Password Field */}
              <FormInput
                label="New Password *"
                value={password}
                onChange={(text) => {
                  setPassword(text);
                  setErrors((prev) => ({ ...prev, password: '' }));
                }}
                error={errors.password}
                placeholder="At least 6 characters"
                maxLength={128}
                disabled={loading}
                secureTextEntry={!showPassword}
              />

              {/* Toggle Password Visibility */}
              <Button
                mode="text"
                onPress={() => setShowPassword(!showPassword)}
                style={styles.toggleButton}
                labelStyle={styles.toggleLabel}
                disabled={loading}
              >
                {showPassword ? 'Hide Password' : 'Show Password'}
              </Button>

              {/* Confirm Password Field */}
              <FormInput
                label="Confirm Password *"
                value={confirmPassword}
                onChange={(text) => {
                  setConfirmPassword(text);
                  setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                error={errors.confirmPassword}
                placeholder="Confirm your password"
                maxLength={128}
                disabled={loading}
                secureTextEntry={!showConfirmPassword}
              />

              {/* Toggle Confirm Password Visibility */}
              <Button
                mode="text"
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.toggleButton}
                labelStyle={styles.toggleLabel}
                disabled={loading}
              >
                {showConfirmPassword ? 'Hide Password' : 'Show Password'}
              </Button>

              {/* Password Requirements */}
              <View style={styles.requirementsSection}>
                <Text
                  style={[
                    styles.requirementsTitle,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Password Requirements:
                </Text>
                <Text
                  style={[
                    styles.requirement,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  • Minimum 6 characters
                </Text>
                <Text
                  style={[
                    styles.requirement,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  • Passwords must match
                </Text>
              </View>
            </View>

            {/* Update Password Button */}
            <Button
              mode="contained"
              onPress={handleSetNewPassword}
              loading={loading}
              disabled={loading || !password.trim() || !confirmPassword.trim()}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              Update Password
            </Button>

            {/* Cancel Button */}
            <Button
              mode="text"
              onPress={handleCancel}
              disabled={loading}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            {/* Success State */}
            <View style={styles.successContainer}>
              <View
                style={[
                  styles.successIconContainer,
                  { backgroundColor: theme.colors.primary + '20' },
                ]}
              >
                <Icon
                  source="check-circle-outline"
                  size={64}
                  color={theme.colors.primary}
                />
              </View>

              <Text
                style={[
                  styles.successTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                Password Updated
              </Text>

              <Text
                style={[
                  styles.successMessage,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Your password has been successfully updated. You will be
                redirected to login shortly.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    flexGrow: 1,
  },

  /* Header Section */
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Form Section */
  formSection: {
    marginBottom: 24,
  },
  toggleButton: {
    marginLeft: -8,
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Requirements Section */
  requirementsSection: {
    marginTop: 16,
    paddingHorizontal: 12,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  requirement: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },

  /* Button Styles */
  button: {
    marginBottom: 12,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 10,
  },
  cancelButton: {
    marginTop: 4,
  },

  /* Success State */
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 21,
  },
});
