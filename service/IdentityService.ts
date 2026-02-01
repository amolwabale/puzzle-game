import Config from 'react-native-config';
import { RegisterPayload, RegisterResponse } from '../model/Register';
import supabase from '../service/SupabaseClient';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Config.SUPABASE_URL;

export const RegisterUser = async (
  payload: RegisterPayload,
): Promise<RegisterResponse> => {
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
};

export async function Login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}
