import type { BooleanHttpClient, HttpResponse } from "@boolean-systems-packages/http";
import type { User, ChangePasswordPayload, MessageResponse } from "../types";

/**
 * Endpoints del usuario autenticado.
 *
 * Todos los métodos retornan `HttpResponse<T>` completo.
 * Todos requieren Authorization header.
 *
 * @example
 * const { data, meta } = await auth.me.get();
 * console.log(data.firstName); // "Valentin"
 */
export class MeResource {
  constructor(private readonly http: BooleanHttpClient) {}

  /**
   * Retorna el perfil del usuario autenticado.
   *
   * Endpoint: GET /mi-usuario/ (authapi Django; Authorization: Token …)
   */
  get(): Promise<HttpResponse<User>> {
    return this.http.get<User>("/mi-usuario/");
  }

  /**
   * Actualiza el perfil del usuario autenticado.
   *
   * Endpoint: PATCH /me/
   */
  update(payload: Partial<Pick<User, "firstName" | "lastName">>): Promise<HttpResponse<User>> {
    return this.http.patch<User>("/me/", payload);
  }

  /**
   * Cambia la contraseña del usuario autenticado.
   *
   * Endpoint: POST /me/change-password/
   */
  changePassword(payload: ChangePasswordPayload): Promise<HttpResponse<MessageResponse>> {
    return this.http.post<MessageResponse>("/me/change-password/", payload);
  }

  /**
   * Elimina la cuenta del usuario autenticado.
   *
   * Endpoint: DELETE /me/
   */
  deleteAccount(): Promise<HttpResponse<null>> {
    return this.http.delete<null>("/me/");
  }
}
