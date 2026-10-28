import {
  BooleanHttpClient,
  HttpError,
  type HttpResponse,
} from "@boolean-systems-packages/http";

export interface PinSetPayload {
  currentPassword: string;
  pin: string;
}

export interface PinVerifyPayload {
  pin: string;
}

export type PinVerificationReason = "sin_pin" | "bloqueado" | "throttle";

export interface PinVerificationResult {
  valid: boolean;
  remainingAttempts?: number;
  lockedUntil?: string;
  reason?: PinVerificationReason;
}

type PinErrorBody = {
  locked_until?: string;
  lockedUntil?: string;
};

type PinVerificationApiResponse = PinVerificationResult & {
  remaining_attempts?: number;
  locked_until?: string;
};

export class PinResource {
  constructor(private readonly http: BooleanHttpClient) {}

  set(payload: PinSetPayload): Promise<HttpResponse<null>> {
    return this.http.put<null>("/mi-usuario/pin/", {
      current_password: payload.currentPassword,
      pin: payload.pin,
    });
  }

  async verify(payload: PinVerifyPayload): Promise<HttpResponse<PinVerificationResult>> {
    try {
      const response = await this.http.post<PinVerificationApiResponse>(
        "/mi-usuario/pin/verificar/",
        payload
      );
      return {
        ...response,
        data: this.normalizeResult(response.data),
      };
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;

      if (error.status === 404) {
        return this.resultResponse(error, { valid: false, reason: "sin_pin" });
      }
      if (error.status === 423) {
        const body = this.asErrorBody(error.body);
        return this.resultResponse(error, {
          valid: false,
          reason: "bloqueado",
          ...(body.locked_until ?? body.lockedUntil
            ? { lockedUntil: body.locked_until ?? body.lockedUntil }
            : {}),
        });
      }
      if (error.status === 429) {
        return this.resultResponse(error, { valid: false, reason: "throttle" });
      }

      throw error;
    }
  }

  private resultResponse(
    error: HttpError,
    data: PinVerificationResult
  ): HttpResponse<PinVerificationResult> {
    return {
      data,
      pagination: null,
      errors: [],
      meta: { message: data.reason ?? "PIN verification failed" },
      status: error.status,
      headers: new Headers(),
      url: error.url,
    };
  }

  private normalizeResult(
    result: PinVerificationApiResponse
  ): PinVerificationResult {
    return {
      valid: result.valid,
      ...(result.remainingAttempts !== undefined || result.remaining_attempts !== undefined
        ? { remainingAttempts: result.remainingAttempts ?? result.remaining_attempts }
        : {}),
      ...(result.lockedUntil !== undefined || result.locked_until !== undefined
        ? { lockedUntil: result.lockedUntil ?? result.locked_until }
        : {}),
      ...(result.reason !== undefined ? { reason: result.reason } : {}),
    };
  }

  private asErrorBody(body: unknown): PinErrorBody {
    if (!body || typeof body !== "object") return {};
    const envelope = body as Record<string, unknown>;
    const candidate = envelope.data && typeof envelope.data === "object"
      ? envelope.data as Record<string, unknown>
      : envelope;
    return {
      ...(typeof candidate.locked_until === "string"
        ? { locked_until: candidate.locked_until }
        : {}),
      ...(typeof candidate.lockedUntil === "string"
        ? { lockedUntil: candidate.lockedUntil }
        : {}),
    };
  }
}
