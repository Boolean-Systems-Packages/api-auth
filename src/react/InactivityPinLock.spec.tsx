// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AuthClient } from "../client";
import type { InactivitySessionGuardConfig } from "../inactivity/inactivity-session-guard";
import { InactivityPinLock } from "./InactivityPinLock";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeClient() {
  let config: InactivitySessionGuardConfig | undefined;
  const inactivity = {
    start: vi.fn((nextConfig: InactivitySessionGuardConfig) => {
      config = nextConfig;
    }),
    stop: vi.fn(),
    confirmActive: vi.fn(),
  };
  const pin = {
    verify: vi.fn(),
    set: vi.fn(),
  };
  const client = { inactivity, pin } as unknown as AuthClient;
  return { client, inactivity, pin, getConfig: () => config };
}

const baseProps = {
  identityKey: "user-1",
  lockAfterMs: 15 * 60_000,
  hasPin: true,
  onLogout: vi.fn(),
};

describe("InactivityPinLock", () => {
  it("muestra un overlay opaco, atrapa el foco y vuelve inerte la aplicacion", async () => {
    const { client, getConfig } = makeClient();
    render(
      <InactivityPinLock client={client} {...baseProps}>
        <main data-testid="app">contenido sensible</main>
      </InactivityPinLock>
    );

    getConfig()!.onWarning();

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.queryByText("contenido sensible")).toBeTruthy();
    const app = Array.from(document.body.children).find((child) =>
      child.contains(screen.getByTestId("app"))
    )!;
    await waitFor(() => expect(app.getAttribute("inert")).not.toBeNull());
    expect(app.getAttribute("aria-hidden")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");

    const dialog = screen.getByRole("dialog");
    const input = screen.getByLabelText("PIN");
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).not.toBe(document.body);
    fireEvent.mouseMove(screen.getByTestId("inactivity-pin-lock"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(input).toBeTruthy();
  });

  it("muestra intentos restantes y destraba con PIN valido", async () => {
    const { client, pin, inactivity, getConfig } = makeClient();
    pin.verify
      .mockResolvedValueOnce({ data: { valid: false, remainingAttempts: 3 } })
      .mockResolvedValueOnce({ data: { valid: true } });
    render(<InactivityPinLock client={client} {...baseProps} />);
    getConfig()!.onWarning();

    const input = await screen.findByLabelText("PIN");
    fireEvent.change(input, { target: { value: "1111" } });
    fireEvent.click(screen.getByRole("button", { name: "Destrabar" }));
    expect((await screen.findByRole("alert")).textContent).toContain("3");

    fireEvent.change(input, { target: { value: "5937" } });
    fireEvent.click(screen.getByRole("button", { name: "Destrabar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(inactivity.confirmActive).toHaveBeenCalledTimes(1);
  });

  it("si Auth informa bloqueo solo deja cerrar sesion", async () => {
    const { client, pin, getConfig } = makeClient();
    pin.verify.mockResolvedValue({
      data: {
        valid: false,
        reason: "bloqueado",
        lockedUntil: "2030-01-01T00:00:00Z",
      },
    });
    render(<InactivityPinLock client={client} {...baseProps} />);
    getConfig()!.onWarning();

    fireEvent.change(await screen.findByLabelText("PIN"), { target: { value: "5937" } });
    fireEvent.click(screen.getByRole("button", { name: "Destrabar" }));

    expect((await screen.findByRole("alert")).textContent).toContain("bloqueado");
    expect(screen.queryByLabelText("PIN")).toBeNull();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeTruthy();
  });

  it("sin PIN solo muestra cerrar sesion", async () => {
    const { client, getConfig } = makeClient();
    render(<InactivityPinLock client={client} {...baseProps} hasPin={false} />);
    getConfig()!.onWarning();

    expect(await screen.findByText("Este usuario no tiene un PIN configurado.")).toBeTruthy();
    expect(screen.queryByLabelText("PIN")).toBeNull();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeTruthy();
  });

  it("si refresh falla deja el bloqueo en estado de sesion vencida", async () => {
    const { client, pin, getConfig } = makeClient();
    pin.verify.mockRejectedValue({ status: 401 });
    render(<InactivityPinLock client={client} {...baseProps} />);
    getConfig()!.onWarning();

    fireEvent.change(await screen.findByLabelText("PIN"), { target: { value: "5937" } });
    fireEvent.click(screen.getByRole("button", { name: "Destrabar" }));

    expect(await screen.findByText("La sesión venció. Cerrá sesión para volver a ingresar.")).toBeTruthy();
    expect(screen.queryByLabelText("PIN")).toBeNull();
  });

  it("reinicia el guard y limpia la pantalla al cambiar identityKey", async () => {
    const { client, inactivity, getConfig } = makeClient();
    const view = render(<InactivityPinLock client={client} {...baseProps} />);
    const oldConfig = getConfig()!;
    oldConfig.onWarning();
    expect(await screen.findByRole("dialog")).toBeTruthy();

    view.rerender(
      <InactivityPinLock client={client} {...baseProps} identityKey="user-2" hasPin={false} />
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(inactivity.stop).toHaveBeenCalledTimes(1);
    expect(inactivity.start).toHaveBeenCalledTimes(2);
    expect(getConfig()!.graceMs).toBeUndefined();
  });

  it("ignora una verificacion pendiente despues de que la sesion vence", async () => {
    const { client, pin, inactivity, getConfig } = makeClient();
    let resolveVerification: ((value: { data: { valid: boolean } }) => void) | undefined;
    pin.verify.mockReturnValue(
      new Promise<{ data: { valid: boolean } }>((resolve) => {
        resolveVerification = resolve;
      })
    );
    render(<InactivityPinLock client={client} {...baseProps} />);
    getConfig()!.onWarning();

    fireEvent.change(await screen.findByLabelText("PIN"), { target: { value: "5937" } });
    fireEvent.click(screen.getByRole("button", { name: "Destrabar" }));
    await waitFor(() => expect(pin.verify).toHaveBeenCalledTimes(1));

    getConfig()!.onSessionExpired();
    resolveVerification!({ data: { valid: true } });

    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.queryByLabelText("PIN")).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(inactivity.confirmActive).not.toHaveBeenCalled();
  });

  it("ignora una verificacion pendiente al cambiar de identidad", async () => {
    const { client, pin, inactivity, getConfig } = makeClient();
    let resolveVerification: ((value: { data: { valid: boolean } }) => void) | undefined;
    pin.verify.mockReturnValue(
      new Promise<{ data: { valid: boolean } }>((resolve) => {
        resolveVerification = resolve;
      })
    );
    const view = render(<InactivityPinLock client={client} {...baseProps} />);
    getConfig()!.onWarning();

    fireEvent.change(await screen.findByLabelText("PIN"), { target: { value: "5937" } });
    fireEvent.click(screen.getByRole("button", { name: "Destrabar" }));
    await waitFor(() => expect(pin.verify).toHaveBeenCalledTimes(1));

    view.rerender(
      <InactivityPinLock client={client} {...baseProps} identityKey="user-2" />
    );
    resolveVerification!({ data: { valid: true } });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(inactivity.confirmActive).not.toHaveBeenCalled();
  });

  it("ignora una verificacion pendiente despues del logout manual", async () => {
    const { client, pin, inactivity, getConfig } = makeClient();
    let resolveVerification: ((value: { data: { valid: boolean } }) => void) | undefined;
    pin.verify.mockReturnValue(
      new Promise<{ data: { valid: boolean } }>((resolve) => {
        resolveVerification = resolve;
      })
    );
    render(<InactivityPinLock client={client} {...baseProps} />);
    getConfig()!.onWarning();

    fireEvent.change(await screen.findByLabelText("PIN"), { target: { value: "5937" } });
    fireEvent.click(screen.getByRole("button", { name: "Destrabar" }));
    await waitFor(() => expect(pin.verify).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /^Cerrar/ }));
    resolveVerification!({ data: { valid: true } });

    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(inactivity.confirmActive).not.toHaveBeenCalled();
    expect(inactivity.stop).toHaveBeenCalledTimes(1);
  });
});
