export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  isActive: boolean;
  roleId: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface MeResponse extends AuthUser {
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  mustChangePassword: boolean;
}
