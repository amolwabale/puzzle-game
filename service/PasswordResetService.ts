/**
 * Password Reset Service
 * 
 * Utility functions for password reset operations.
 * Provides a clean interface for password reset operations used across the app.
 */

import supabase from './SupabaseClient';

/**
 * Request password reset email
 * 
 * @param email - User's email address
 * @returns { success: boolean, error?: string }
 * 
 * Security: Always returns success (never reveals if email exists)
 * This prevents email enumeration attacks
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!email || !email.trim()) {
      return { success: false, error: 'Email is required' };
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Validate email format (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return { success: false, error: 'Invalid email format' };
    }

    // Call Supabase API
    // For security, this never reveals whether email exists or not
    const { error } = await supabase.auth.resetPasswordForEmail(
      trimmedEmail,
      {
        redirectTo: 'tenantmanager://reset-password',
      },
    );

    if (error) {
      console.error('Password reset request error:', error);
      // Don't expose error to user (security best practice)
      return { success: true, error: undefined }; // Always return success
    }

    return { success: true };
  } catch (err: any) {
    console.error('Unexpected error in password reset request:', err);
    // Don't expose error to user
    return { success: true, error: undefined }; // Always return success
  }
}

/**
 * Update user password (after token validation)
 * 
 * @param newPassword - New password (min 6 characters)
 * @returns { success: boolean, error?: string }
 * 
 * Prerequisites:
 * - User session must be established (from reset link tokens)
 * - Session is validated before attempt
 */
export async function updatePassword(
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    // Verify session exists
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.user?.id) {
      return {
        success: false,
        error: 'Session expired. Please request a new password reset link.',
      };
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
      password: newPassword.trim(),
    });

    if (error) {
      console.error('Password update error:', error);
      return {
        success: false,
        error: error.message || 'Failed to update password',
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Unexpected error updating password:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Parse reset password deep link URL
 * Extract access_token and refresh_token from URL
 * 
 * @param url - Deep link URL (e.g., tenantmanager://reset-password?access_token=...)
 * @returns { accessToken?: string, refreshToken?: string, code?: string }
 * 
 * Handles multiple URL formats:
 * - Query parameters: ?access_token=...&refresh_token=...
 * - Hash fragment: #access_token=...&refresh_token=...
 */
export function parseResetPasswordLink(url: string): {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
} {
  try {
    // Parse query and fragment manually (compatible with React Native)
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    let code: string | undefined;

    // Split by ? to get query string
    const parts = url.split('?');
    let paramsStr = '';
    
    if (parts.length > 1) {
      paramsStr = parts[1];
    } else if (url.includes('#')) {
      // Try hash fragment
      const hashParts = url.split('#');
      if (hashParts.length > 1) {
        paramsStr = hashParts[1];
      }
    }

    // Parse params manually
    if (paramsStr) {
      const paramPairs = paramsStr.split('&');
      for (const pair of paramPairs) {
        const [key, value] = pair.split('=');
        const decodedValue = value ? decodeURIComponent(value) : '';
        
        if (key === 'access_token') {
          accessToken = decodedValue;
        } else if (key === 'refresh_token') {
          refreshToken = decodedValue;
        } else if (key === 'code') {
          code = decodedValue;
        }
      }
    }

    return { accessToken, refreshToken, code };
  } catch (err: any) {
    console.error('Error parsing reset password link:', err);
    return {};
  }
}

/**
 * Establish session from password reset tokens
 * 
 * @param accessToken - Access token from reset link
 * @param refreshToken - Refresh token from reset link
 * @returns { success: boolean, error?: string, session?: any }
 * 
 * This is called after parsing the deep link
 */
export async function establishSessionFromResetLink(
  accessToken: string,
  refreshToken: string,
): Promise<{ success: boolean; error?: string; session?: any }> {
  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('Error setting session from reset link:', error);
      return {
        success: false,
        error: error.message || 'Failed to establish session',
      };
    }

    return { success: true, session: data.session };
  } catch (err: any) {
    console.error('Unexpected error establishing session:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Exchange code for session (alternative OAuth flow)
 * 
 * @param code - Code from reset link
 * @returns { success: boolean, error?: string, session?: any }
 */
export async function exchangeCodeForSessionFromReset(
  code: string,
): Promise<{ success: boolean; error?: string; session?: any }> {
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return {
        success: false,
        error: error.message || 'Failed to exchange code',
      };
    }

    return { success: true, session: data.session };
  } catch (err: any) {
    console.error('Unexpected error exchanging code:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Validate password strength
 * 
 * @param password - Password to validate
 * @returns { isValid: boolean, errors: string[] }
 * 
 * Requirements:
 * - Minimum 6 characters
 * - No spaces at start/end
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
  } else {
    if (password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }
    if (password !== password.trim()) {
      errors.push('Password cannot start or end with spaces');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if passwords match
 * 
 * @param password - Password
 * @param confirmPassword - Confirmation password
 * @returns { isValid: boolean, error?: string }
 */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string,
): { isValid: boolean; error?: string } {
  if (password !== confirmPassword) {
    return {
      isValid: false,
      error: 'Passwords do not match',
    };
  }

  return { isValid: true };
}

export default {
  requestPasswordReset,
  updatePassword,
  parseResetPasswordLink,
  establishSessionFromResetLink,
  exchangeCodeForSessionFromReset,
  validatePasswordStrength,
  validatePasswordMatch,
};
