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
  Surface,
  useTheme,
  ActivityIndicator,
  Icon,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/StackParam';
import { FormInput } from '../../components/FormInput';
import supabase from '../../service/SupabaseClient';
import { trackEvent } from '../../service/analyticsTracker';

type NavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'ForgotPasswordScreen'
>;

/**
 * ForgotPasswordScreen - Password reset flow entry point
 *
 * UX Flow:
 * 1. User enters email
 * 2. Clicks "Send Reset Link"
 * 3. Supabase sends reset email (if email exists)
 * 4. User always sees success message (never reveals if email exists)
 * 5. User receives email and clicks link
 * 6. Deep link: tenantmanager://reset-password redirects to SetNewPasswordScreen
 *
 * Security:
 * ✅ Uses Supabase resetPasswordForEmail()
 * ✅ Never displays "email not found"
 * ✅ Generic success message for all cases
 * ✅ No sensitive data in logs
 */
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [errors, setErrors] = React.useState<{ email: string }>({ email: '' });

  /**
   * Validate email format (basic)
   */
  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  /**
   * Handle password reset request
   * - Always shows generic success message (security best practice)
   * - Never reveals if email exists or not
   */
  const handleSendResetLink = async () => {
    // Clear previous errors
    setErrors({ email: '' });

    // Validate email
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrors({ email: 'Email is required' });
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    try {
      setLoading(true);

      // Call Supabase reset password API
      // This handles both registered and non-registered emails silently
      const { error } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          // Deep link that will be sent in the email
          // When user clicks link, app opens and extracts session tokens
          redirectTo: `${Platform.OS === 'ios' ? 'tenantmanager' : 'tenantmanager'}://reset-password`,
        },
      );

      // For security, we ALWAYS show the same success message
      // This prevents email enumeration attacks
      setSuccess(true);
      trackEvent('Auth_ResetPassword_Sent', {
        success: !error,
        hasError: !!error,
      });

      if (error) {
        // Log error for debugging but don't show to user
        console.error('Reset password error:', error);
      }
    } catch (err: any) {
      // Catch unexpected errors but still show generic message
      console.error('Unexpected error in password reset:', err);
      // Don't show specific error to user - security best practice
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigate back to login
   */
  const handleBackToLogin = () => {
    navigation.navigate('LoginScreen');
    trackEvent('Auth_ForgotPassword_BackToLogin', {});
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
                  source="lock-reset"
                  size={40}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                Reset Password
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Enter your registered email to receive a reset link
              </Text>
            </View>

            {/* Email Input Section */}
            <View style={styles.formSection}>
              <FormInput
                label="Email address *"
                value={email}
                onChange={(text) => {
                  setEmail(text);
                  setErrors({ email: '' });
                }}
                error={errors.email}
                placeholder="you@example.com"
                maxLength={254}
                disabled={loading}
              />
            </View>

            {/* Send Reset Link Button */}
            <Button
              mode="contained"
              onPress={handleSendResetLink}
              loading={loading}
              disabled={loading || !email.trim()}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              Send Reset Link
            </Button>

            {/* Back to Login Button */}
            <Button
              mode="text"
              onPress={handleBackToLogin}
              disabled={loading}
              style={styles.backButton}
            >
              Back to Login
            </Button>
          </>
        ) : (
          <>
            {/* Success State */}
            <View style={[styles.successContainer, { alignItems: 'center' }]}>
              <View
                style={[
                  styles.successIconContainer,
                  { backgroundColor: theme.colors.primary + '20' },
                ]}
              >
                <Icon
                  source="email-check-outline"
                  size={56}
                  color={theme.colors.primary}
                />
              </View>

              <Text
                style={[
                  styles.successTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                Check Your Email
              </Text>

              <Text
                style={[
                  styles.successMessage,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                If this email is registered, you will receive a reset link
                shortly. Please check your inbox and spam folder.
              </Text>

              {/* Resend or Back Buttons */}
              <View style={styles.successButtonGroup}>
                <Button
                  mode="contained"
                  onPress={() => {
                    setSuccess(false);
                    setEmail('');
                  }}
                  style={styles.resendButton}
                  contentStyle={styles.buttonContent}
                >
                  Try Another Email
                </Button>

                <Button
                  mode="text"
                  onPress={handleBackToLogin}
                  style={styles.successBackButton}
                >
                  Back to Login
                </Button>
              </View>
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

  /* Button Styles */
  button: {
    marginBottom: 12,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 10,
  },
  backButton: {
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
    marginBottom: 32,
  },
  successButtonGroup: {
    width: '100%',
    gap: 12,
  },
  resendButton: {
    borderRadius: 12,
  },
  successBackButton: {
    marginTop: 4,
  },
});
