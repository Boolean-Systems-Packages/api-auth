import { describe, expect, it, vi } from "vitest";
import { HttpError } from "@boolean-systems-packages/http";
import { PinResource } from "./pin";

function makeHttp() {
  return {
    put: vi.fn(),
    post: vi.fn(),
  };
}

function httpError(status: number, body: unknown = undefined) {
  return new HttpError("request failed", {
    status,
    method: "POST",
    url: "https://auth.test/mi-usuario/pin/verificar/",
    body,
  });
}

describe("PinResource", () => {
  it("envia current_password y pin al endpoint de alta/cambio", async () => {
    const http = makeHttp();
    http.put.mockResolvedValue({ data: null, status: 204 });
    const resource = new PinResource(http as never);

    await resource.set({ currentPassword: "secret", pin: "5937" });

    expect(http.put).toHaveBeenCalledWith("/mi-usuario/pin/", {
      current_password: "secret",
      pin: "5937",
    });
  });

  it("devuelve la respuesta tipada de una verificacion exitosa", async () => {
    const http = makeHttp();
    http.post.mockResolvedValue({
      data: { valid: true },
      status: 200,
    });
    const resource = new PinResource(http as never);

    await expect(resource.verify({ pin: "5937" })).resolves.toMatchObject({
      data: { valid: true },
    });
  });

  it("convierte los campos snake_case de Auth al resultado del SDK", async () => {
    const http = makeHttp();
    http.post.mockResolvedValue({
      data: {
        valid: false,
        remaining_attempts: 3,
      },
      status: 200,
    });
    const resource = new PinResource(http as never);

    await expect(resource.verify({ pin: "5937" })).resolves.toMatchObject({
      data: { valid: false, remainingAttempts: 3 },
    });
  });

  it("normaliza 404, 423 y 429 sin convertirlos en error generico", async () => {
    for (const [status, expected] of [
      [404, { valid: false, reason: "sin_pin" }],
      [423, { valid: false, reason: "bloqueado", lockedUntil: "2030-01-01T00:00:00Z" }],
      [429, { valid: false, reason: "throttle" }],
    ] as const) {
      const http = makeHttp();
      http.post.mockRejectedValue(
        httpError(status, status === 423 ? { locked_until: "2030-01-01T00:00:00Z" } : undefined)
      );
      const resource = new PinResource(http as never);

      await expect(resource.verify({ pin: "0000" })).resolves.toMatchObject({
        status,
        data: expected,
      });
    }
  });

  it("propaga errores HTTP no relacionados con el estado del PIN", async () => {
    const http = makeHttp();
    const error = httpError(500);
    http.post.mockRejectedValue(error);
    const resource = new PinResource(http as never);

    await expect(resource.verify({ pin: "5937" })).rejects.toBe(error);
  });
});
