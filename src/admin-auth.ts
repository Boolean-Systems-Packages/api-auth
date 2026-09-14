export interface VerifyCredentialsPayload {
  username: string;
  password: string;
  action: string;
  companyId: string;
  actorUserId?: string | undefined;
  requiredRole?: string | undefined;
}

export interface VerifyCredentialsResponse {
  valid: boolean;
  user_id?: number | undefined;
  is_admin?: boolean | undefined;
}

export interface RequestAdminAuthorizationInput {
  username: string;
  password: string;
  action: string;
}

export interface RequestAdminAuthorizationResult {
  authorized: boolean;
  userId?: number | undefined;
  isAdmin?: boolean | undefined;
}

export interface AdminAuthPromptLabels {
  title?: string | undefined;
  description?: string | undefined;
  username?: string | undefined;
  password?: string | undefined;
  confirm?: string | undefined;
  cancel?: string | undefined;
  invalid?: string | undefined;
}
