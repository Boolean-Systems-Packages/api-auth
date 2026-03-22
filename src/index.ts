/**
 * @boolean/api-auth
 *
 * SDK del microservicio de autenticación Boolean.
 * Construido sobre `@boolean/http`.
 *
 * @example
 * import { createAuthClient } from "@boolean/api-auth";
 *
 * const auth = createAuthClient({
 *   baseURL: "https://api.boolean.com.ar/auth",
 *   getAuthHeader: () => `Bearer ${getToken()}`,
 * });
 *
 * const session = await auth.sessions.login({ email, password });
 */

// Cliente y factory
export { AuthClient, createAuthClient } from "./client";

// Recursos (por si alguien necesita extenderlos)
export { SessionsResource } from "./resources/sessions";
export { MeResource } from "./resources/me";
export { PasswordRecoveryResource } from "./resources/password-recovery";

// Tipos de dominio y configuración
export type {
  AuthClientConfig,
  User,
  TokenPair,
  Session,
  LoginPayload,
  RegisterPayload,
  RefreshTokenPayload,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  MessageResponse,
} from "./types";
