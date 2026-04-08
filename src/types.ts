import type { GetAuthHeader, BaseClientConfig } from "@boolean-systems-packages/http";

/**
 * Información del dispositivo/navegador que se envía como headers
 * en todos los requests del cliente de auth.
 *
 * Inferida del curl real: portal.boolean.com.ar/api/auth/v3/login/
 *
 * @example
 * deviceContext: {
 *   fingerprint: generateFingerprint(),  // hash del browser
 *   deviceId: getOrCreateDeviceId(),     // persiste en localStorage
 *   language: navigator.language,
 *   platform: navigator.platform,
 *   screenResolution: `${screen.width}x${screen.height}`,
 *   timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
 * }
 */
export interface DeviceContext {
  /** SHA256 del browser. Header: x-browser-fingerprint */
  fingerprint: string;
  /** ID único del dispositivo. Header: x-device-id */
  deviceId: string;
  /** Idioma del browser. Header: x-language. Ej: "es-ES" */
  language?: string | undefined;
  /** Plataforma. Header: x-platform. Ej: "MacIntel" */
  platform?: string | undefined;
  /** Resolución de pantalla. Header: x-screen-resolution. Ej: "1280x800" */
  screenResolution?: string | undefined;
  /** Timezone IANA. Header: x-timezone. Ej: "America/Cordoba" */
  timezone?: string | undefined;
}

/**
 * Configuración del cliente de autenticación Boolean.
 *
 * @example
 * const auth = createAuthClient({
 *   baseURL: "https://portal.boolean.com.ar/api/auth/v3",
 *   getAuthHeader: () => `Bearer ${localStorage.getItem("access_token")}`,
 *   deviceContext: {
 *     fingerprint: getFingerprint(),
 *     deviceId: getDeviceId(),
 *     language: navigator.language,
 *     platform: navigator.platform,
 *     screenResolution: `${screen.width}x${screen.height}`,
 *     timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
 *   },
 * });
 */
export interface AuthClientConfig extends BaseClientConfig {
  /**
   * Contexto del dispositivo. Se envía como headers en todos los requests.
   * Requerido por el backend para fingerprinting y seguridad.
   */
  deviceContext?: DeviceContext | undefined;

  /**
   * Función que retorna el refreshToken actual desde el storage.
   * Requerido para el refresh automático de tokens.
   *
   * @example
   * getRefreshToken: () => localStorage.getItem("refresh_token")
   */
  getRefreshToken?: (() => string | null) | undefined;

  /**
   * Callback que se llama cuando el refresh fue exitoso.
   * Debe guardar los nuevos tokens en el storage.
   *
   * @example
   * onTokensRefreshed: ({ accessToken, refreshToken }) => {
   *   localStorage.setItem("access_token", accessToken);
   *   localStorage.setItem("refresh_token", refreshToken);
   * }
   */
  onTokensRefreshed?: ((tokens: TokenPair) => void) | undefined;

  /**
   * Callback que se llama cuando el refresh falla (refreshToken vencido).
   * Típicamente: limpiar tokens y redirigir al login.
   *
   * @example
   * onAuthFailure: () => {
   *   localStorage.clear();
   *   window.location.href = "/login";
   * }
   */
  onAuthFailure?: (() => void) | undefined;
}


// ─────────────────────────────────────────────
// Modelos de dominio Auth
// ─────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Segundos hasta que expira el accessToken */
  expiresIn: number;
}

export interface Session {
  user: User;
  tokens: TokenPair;
}

// ─────────────────────────────────────────────
// Payloads de request
// ─────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RefreshTokenPayload {
  refreshToken: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

// ─────────────────────────────────────────────
// Respuestas de la API
// ─────────────────────────────────────────────

export interface MessageResponse {
  message: string;
}
