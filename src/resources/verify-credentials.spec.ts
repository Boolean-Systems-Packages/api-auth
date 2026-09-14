import { describe, expect, it, vi } from "vitest";
import { VerifyCredentialsResource } from "../src/resources/verify-credentials";

describe("VerifyCredentialsResource", () => {
  it("sends tenant in X-Company-Id and maps valid true", async () => {
    const post = vi.fn().mockResolvedValue({
      data: { valid: true, user_id: 9, is_admin: true },
    });
    const resource = new VerifyCredentialsResource({ post } as never);

    const result = await resource.requestAdminAuthorization({
      username: "laura",
      password: "secret",
      action: "emit_nc",
      companyId: "tenant-uuid",
      actorUserId: "42",
    });

    expect(result).toEqual({ authorized: true, userId: 9, isAdmin: true });
    expect(post).toHaveBeenCalledWith(
      "/service/verify-credentials/",
      {
        username: "laura",
        password: "secret",
        action: "emit_nc",
        required_role: "admin",
      },
      {
        headers: {
          "X-Company-Id": "tenant-uuid",
          "X-Actor-User-Id": "42",
        },
      }
    );
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty("company_uuid");
  });

  it("maps valid false", async () => {
    const resource = new VerifyCredentialsResource({
      post: vi.fn().mockResolvedValue({ data: { valid: false } }),
    } as never);
    const result = await resource.requestAdminAuthorization({
      username: "juan",
      password: "bad",
      action: "emit_nc",
      companyId: "tenant-uuid",
    });
    expect(result).toEqual({ authorized: false });
  });
});
