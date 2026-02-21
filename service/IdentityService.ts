import Config from 'react-native-config';
import { RegisterPayload, RegisterResponse } from '../model/Register';
import supabase from './SupabaseClient';
import { traceAsync } from './perfTrace';

const SUPABASE_URL = Config.SUPABASE_URL;

export const RegisterUser = async (
  payload: RegisterPayload,
): Promise<RegisterResponse> => {
  return traceAsync('action_register', async () => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/tenant-manager/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Registration failed');
    }

    return result;
  });
};

export async function Login(email: string, password: string) {
  return traceAsync('action_login', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  });
}

export async function LoginWithGoogleIdToken(idToken: string) {
  try {
    return await traceAsync('action_google_login', async () => {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      return { data, error };
    });
  } catch (e: any) {
    // Ensure callers never receive an unhandled rejection (Android shows redbox).
    return { data: null, error: e };
  }
}
