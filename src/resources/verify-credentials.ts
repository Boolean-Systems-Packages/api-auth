import type { BooleanHttpClient, HttpResponse } from "@boolean-systems-packages/http";
import type {
  RequestAdminAuthorizationResult,
  VerifyCredentialsPayload,
  VerifyCredentialsResponse,
} from "../admin-auth";

/**
 * Verifica usuario + clave de un admin del tenant sin crear sesión.
 *
 * Endpoint: POST /service/verify-credentials/
 * Auth: identidad M2M del micro llamante (Bearer o X-Service-Key vía getAuthHeader).
 * El tenant va en X-Company-Id, nunca en el body.
 */
export class VerifyCredentialsResource {
  constructor(private readonly http: BooleanHttpClient) {}

  verify(
    payload: VerifyCredentialsPayload
  ): Promise<HttpResponse<VerifyCredentialsResponse>> {
    const headers: Record<string, string> = {
      "X-Company-Id": payload.companyId,
    };
    if (payload.actorUserId) {
      headers["X-Actor-User-Id"] = payload.actorUserId;
    }

    return this.http.post<VerifyCredentialsResponse>(
      "/service/verify-credentials/",
      {
        username: payload.username,
        password: payload.password,
        action: payload.action,
        required_role: payload.requiredRole ?? "admin",
      },
      { headers }
    );
  }

  async requestAdminAuthorization(
    payload: VerifyCredentialsPayload
  ): Promise<RequestAdminAuthorizationResult> {
    try {
      const { data } = await this.verify(payload);
      if (!data?.valid) {
        return { authorized: false };
      }
      return {
        authorized: true,
        ...(data.user_id !== undefined ? { userId: data.user_id } : {}),
        ...(data.is_admin !== undefined ? { isAdmin: data.is_admin } : {}),
      };
    } catch {
      return { authorized: false };
    }
  }
}
