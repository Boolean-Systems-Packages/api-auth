import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  config: undefined as Record<string, any> | undefined,
  post: vi.fn(),
}));

vi.mock("@boolean-systems-packages/http", () => ({
  BooleanHttpClient: class FakeBooleanHttpClient {
    constructor(config: Record<string, any>) {
      mockState.config = config;
    }

    post(...args: unknown[]) {
      return mockState.post(...args);
    }

    get() {
      return Promise.resolve({});
    }

    put() {
      return Promise.resolve({});
    }

    patch() {
      return Promise.resolve({});
    }

    delete() {
      return Promise.resolve({});
    }
  },
}));

import { createAuthClient } from "./client";

describe("AuthClient refresh", () => {
  beforeEach(() => {
    mockState.config = undefined;
    mockState.post.mockReset();
  });

  it("normaliza la respuesta access/refresh de auth.back antes de notificar al host", async () => {
    const onTokensRefreshed = vi.fn();
    const client = createAuthClient({
      baseURL: "http://auth.local/v2",
      getAuthHeader: () => "Bearer expired-access",
      getRefreshToken: () => "refresh-token",
      onTokensRefreshed,
    });

    expect(mockState.config?.unauthorizedStatuses).toEqual([401, 403]);

    mockState.post.mockResolvedValue({
      data: { access: "new-access", refresh: "new-refresh" },
    });

    await expect(mockState.config?.onUnauthorized()).resolves.toBe(true);

    expect(onTokensRefreshed).toHaveBeenCalledWith({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 0,
    });
  });
});
