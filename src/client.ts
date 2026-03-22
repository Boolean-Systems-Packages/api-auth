import { BooleanHttpClient } from "@boolean/http";
import { SessionsResource } from "./resources/sessions";
import { MeResource } from "./resources/me";
import { PasswordRecoveryResource } from "./resources/password-recovery";
import type { AuthClientConfig, DeviceContext, TokenPair } from "./types";

/**
 * Cliente del microservicio de autenticación Boolean.
 *
 * Usa `@boolean/http` internamente para toda la comunicación HTTP.
 * Expone los endpoints agrupados por recurso (sessions, me, passwordRecovery).
 *
 * ✅ Configuración explícita — sin defaults silenciosos
 * ✅ Sin lógica de negocio — solo encapsula endpoints
 * ✅ Tipado completo — cada método retorna el tipo exacto
 *
 * @example
 * import { createAuthClient } from "@boolean/api-auth";
 *
 * const auth = createAuthClient({
 *   baseURL: "https://portal.boolean.com.ar/api/auth/v3",
 *   getAuthHeader: () => `Bearer ${localStorage.getItem("access_token")}`,
 *   deviceContext: {
 *     fingerprint: getFingerprint(),
 *     deviceId: getOrCreateDeviceId(),
 *     language: navigator.language,
 *     timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
 *   },
 * });
 *
 * // Login
 * const session = await auth.sessions.login({ email, password });
 *
 * // Perfil del usuario
 * const me = await auth.me.get();
 *
 * // Logout
 * await auth.sessions.logout();
 */
export class AuthClient {
  /** Endpoints de sesión: login, register, logout, refresh */
  public readonly sessions: SessionsResource;

  /** Endpoints del usuario autenticado: perfil, cambio de contraseña */
  public readonly me: MeResource;

  /** Endpoints de recuperación de contraseña */
  public readonly passwordRecovery: PasswordRecoveryResource;

  private readonly http: BooleanHttpClient;

  constructor(config: AuthClientConfig) {
    this.http = new BooleanHttpClient({
      baseURL: config.baseURL,
      getAuthHeader: config.getAuthHeader,
      timeout: config.timeout,
      defaultHeaders: deviceContextToHeaders(config.deviceContext),

      // Refresh automático: se llama una sola vez aunque múltiples
      // requests fallen con 401 simultáneamente (singleton en @boolean/http).
      onUnauthorized: config.getRefreshToken
        ? async () => {
            const refreshToken = config.getRefreshToken!();
            if (!refreshToken) {
              config.onAuthFailure?.();
              return false;
            }
            try {
              const { data } = await this.http.post<TokenPair>(
                "/token/refresh/",
                { refreshToken },
                { skipAuth: true }
              );
              config.onTokensRefreshed?.(data);
              return true; // reintenta el request original
            } catch {
              config.onAuthFailure?.();
              return false;
            }
          }
        : undefined,
    });

    this.sessions = new SessionsResource(this.http);
    this.me = new MeResource(this.http);
    this.passwordRecovery = new PasswordRecoveryResource(this.http);
  }

  /**
   * Acceso al cliente HTTP subyacente para casos avanzados:
   * agregar interceptors, hacer requests a endpoints no cubiertos, etc.
   *
   * @example
   * auth.httpClient.addRequestInterceptor(async (ctx) => {
   *   console.log(`→ ${ctx.method} ${ctx.url}`);
   *   return ctx;
   * });
   */
  get httpClient(): BooleanHttpClient {
    return this.http;
  }
}

/**
 * Factory function para crear el cliente Auth.
 * Es la forma recomendada de instanciarlo.
 *
 * @example
 * const auth = createAuthClient({
 *   baseURL: process.env.AUTH_API_URL,
 *   getAuthHeader: () => `Bearer ${getToken()}`,
 * });
 */
export function createAuthClient(config: AuthClientConfig): AuthClient {
  return new AuthClient(config);
}

// ─────────────────────────────────────────────
// Helpers privados
// ─────────────────────────────────────────────

/**
 * Convierte un DeviceContext en el mapa de headers que espera BooleanHttpClient.
 * Los campos undefined se omiten para no enviar headers vacíos.
 */
function deviceContextToHeaders(
  ctx: DeviceContext | undefined
): Record<string, string> {
  if (!ctx) return {};

  const headers: Record<string, string> = {
    "x-browser-fingerprint": ctx.fingerprint,
    "x-device-id": ctx.deviceId,
  };

  if (ctx.language)         headers["x-language"]          = ctx.language;
  if (ctx.platform)         headers["x-platform"]          = ctx.platform;
  if (ctx.screenResolution) headers["x-screen-resolution"] = ctx.screenResolution;
  if (ctx.timezone)         headers["x-timezone"]          = ctx.timezone;

  return headers;
}
