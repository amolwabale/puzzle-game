export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  mobile?: string;
  address?: string;
}

export interface RegisterResponse {
  success: boolean;
  userId?: string;
  error?: string;
}
