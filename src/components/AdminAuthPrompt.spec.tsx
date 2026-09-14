/** @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminAuthPrompt } from "./AdminAuthPrompt";

afterEach(cleanup);

describe("AdminAuthPrompt", () => {
  it("calls authorize and onAuthorized when credentials are accepted", async () => {
    const authorize = vi.fn().mockResolvedValue({ authorized: true });
    const onAuthorized = vi.fn();
    render(
      <AdminAuthPrompt
        open
        action="emit_nc"
        authorize={authorize}
        onAuthorized={onAuthorized}
        onCancel={() => undefined}
      />
    );

    fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "laura" } });
    fireEvent.change(screen.getByLabelText("Clave"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Autorizar" }));

    await waitFor(() => {
      expect(authorize).toHaveBeenCalledWith({
        username: "laura",
        password: "secret",
        action: "emit_nc",
      });
      expect(onAuthorized).toHaveBeenCalled();
    });
  });

  it("shows an error when authorization fails and does not close", async () => {
    const authorize = vi.fn().mockResolvedValue({ authorized: false });
    const onAuthorized = vi.fn();
    render(
      <AdminAuthPrompt
        open
        action="emit_nc"
        authorize={authorize}
        onAuthorized={onAuthorized}
        onCancel={() => undefined}
      />
    );

    fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "juan" } });
    fireEvent.change(screen.getByLabelText("Clave"), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Autorizar" }));

    expect(
      await screen.findByText(
        "Las credenciales no son válidas o esa persona no es administrador de esta empresa."
      )
    ).toBeTruthy();
    expect(onAuthorized).not.toHaveBeenCalled();
  });
});
