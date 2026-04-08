import type { BooleanHttpClient, HttpResponse } from "@boolean-systems-packages/http";
import type { Session, LoginPayload, RegisterPayload, RefreshTokenPayload, TokenPair } from "../types";

/**
 * Endpoints de sesión: login, register, logout, refresh.
 *
 * Todos los métodos retornan `HttpResponse<T>` completo:
 * el frontend recibe `data`, `errors`, `meta` y `pagination`
 * sin que el SDK manipule nada.
 *
 * @example
 * const { data, errors, meta } = await auth.sessions.login({ email, password });
 * if (errors.length > 0) showError(errors[0].message);
 * else saveToken(data.tokens.accessToken);
 */
export class SessionsResource {
  constructor(private readonly http: BooleanHttpClient) {}

  /**
   * Inicia sesión con email y contraseña.
   *
   * Endpoint: POST /login/
   * Público — no requiere Authorization header.
   *
   * @example
   * const { data, errors, meta } = await auth.sessions.login({
   *   email: "user@boolean.com.ar",
   *   password: "secret",
   * });
   */
  login(payload: LoginPayload): Promise<HttpResponse<Session>> {
    return this.http.post<Session>("/login/", payload, { skipAuth: true });
  }

  /**
   * Registra un nuevo usuario.
   *
   * Endpoint: POST /register/
   * Público.
   */
  register(payload: RegisterPayload): Promise<HttpResponse<Session>> {
    return this.http.post<Session>("/register/", payload, { skipAuth: true });
  }

  /**
   * Renueva el accessToken usando el refreshToken.
   *
   * Endpoint: POST /token/refresh/
   * Público (el refreshToken actúa como credencial).
   */
  refresh(payload: RefreshTokenPayload): Promise<HttpResponse<TokenPair>> {
    return this.http.post<TokenPair>("/token/refresh/", payload, { skipAuth: true });
  }

  /**
   * Cierra la sesión actual.
   *
   * Endpoint: DELETE /logout/
   * Requiere Authorization header.
   */
  logout(): Promise<HttpResponse<null>> {
    return this.http.delete<null>("/logout/");
  }
}
