import type { BooleanHttpClient, HttpResponse } from "@boolean-systems-packages/http";
import type { ForgotPasswordPayload, ResetPasswordPayload, MessageResponse } from "../types";

/**
 * Endpoints de recuperación de contraseña.
 * Ambos son públicos — no requieren Authorization header.
 *
 * @example
 * const { data, meta } = await auth.passwordRecovery.forgot({ email: "user@boolean.com.ar" });
 * toast(meta.message); // "Si el email existe, recibirás un link"
 */
export class PasswordRecoveryResource {
  constructor(private readonly http: BooleanHttpClient) {}

  /**
   * Solicita un email de recuperación.
   * Siempre retorna un mensaje genérico (no revela si el email existe).
   *
   * Endpoint: POST /password-recovery/forgot/
   */
  forgot(payload: ForgotPasswordPayload): Promise<HttpResponse<MessageResponse>> {
    return this.http.post<MessageResponse>("/password-recovery/forgot/", payload, { skipAuth: true });
  }

  /**
   * Resetea la contraseña usando el token del email.
   *
   * Endpoint: POST /password-recovery/reset/
   */
  reset(payload: ResetPasswordPayload): Promise<HttpResponse<MessageResponse>> {
    return this.http.post<MessageResponse>("/password-recovery/reset/", payload, { skipAuth: true });
  }
}
