// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AuthClient } from "../client";
import { PinSetupDialog } from "./PinSetupDialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeClient() {
  const pin = { set: vi.fn() };
  return {
    client: { pin } as unknown as AuthClient,
    pin,
  };
}

function fillForm() {
  fireEvent.change(screen.getByLabelText("Contraseña actual"), {
    target: { value: "agil2025" },
  });
  fireEvent.change(screen.getByLabelText("PIN de 4 a 6 dígitos"), {
    target: { value: "5937" },
  });
  fireEvent.change(screen.getByLabelText("Repetir PIN"), {
    target: { value: "5937" },
  });
}

describe("PinSetupDialog", () => {
  it("permite mostrar y ocultar contraseña, PIN y confirmación", () => {
    const { client } = makeClient();
    render(<PinSetupDialog client={client} />);

    const password = screen.getByLabelText("Contraseña actual");
    const pin = screen.getByLabelText("PIN de 4 a 6 dígitos");
    const confirmation = screen.getByLabelText("Repetir PIN");
    expect(password.getAttribute("type")).toBe("password");
    expect(pin.getAttribute("type")).toBe("password");
    expect(confirmation.getAttribute("type")).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Mostrar Contraseña actual" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN de 4 a 6 dígitos" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar Repetir PIN" }));

    expect(password.getAttribute("type")).toBe("text");
    expect(pin.getAttribute("type")).toBe("text");
    expect(confirmation.getAttribute("type")).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Ocultar Contraseña actual" }));
    expect(password.getAttribute("type")).toBe("password");
  });

  it("limpia los secretos al cancelar y al reabrir el dialogo controlado", () => {
    const { client } = makeClient();
    const onCancel = vi.fn();
    const view = render(
      <PinSetupDialog client={client} open onCancel={onCancel} />
    );

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar Contraseña actual" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN de 4 a 6 dígitos" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar Repetir PIN" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    view.rerender(<PinSetupDialog client={client} open={false} onCancel={onCancel} />);
    view.rerender(<PinSetupDialog client={client} open onCancel={onCancel} />);

    expect((screen.getByLabelText("Contraseña actual") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("PIN de 4 a 6 dígitos") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Repetir PIN") as HTMLInputElement).value).toBe("");
    expect(screen.getByLabelText("Contraseña actual").getAttribute("type")).toBe("password");
    expect(screen.getByLabelText("PIN de 4 a 6 dígitos").getAttribute("type")).toBe("password");
    expect(screen.getByLabelText("Repetir PIN").getAttribute("type")).toBe("password");
  });

  it("limpia los secretos si el host cierra el dialogo sin cancelar", async () => {
    const { client } = makeClient();
    const view = render(<PinSetupDialog client={client} open />);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar Contraseña actual" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN de 4 a 6 dígitos" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar Repetir PIN" }));

    view.rerender(<PinSetupDialog client={client} open={false} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    view.rerender(<PinSetupDialog client={client} open />);

    expect((screen.getByLabelText("Contraseña actual") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("PIN de 4 a 6 dígitos") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Repetir PIN") as HTMLInputElement).value).toBe("");
    expect(screen.getByLabelText("Contraseña actual").getAttribute("type")).toBe("password");
    expect(screen.getByLabelText("PIN de 4 a 6 dígitos").getAttribute("type")).toBe("password");
    expect(screen.getByLabelText("Repetir PIN").getAttribute("type")).toBe("password");
  });

  it("crea o cambia el PIN con contraseña, PIN y confirmacion", async () => {
    const { client, pin } = makeClient();
    const onDone = vi.fn();
    pin.set.mockResolvedValue({ data: null });
    render(<PinSetupDialog client={client} onDone={onDone} />);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Guardar PIN" }));

    await waitFor(() => expect(pin.set).toHaveBeenCalledWith({
      currentPassword: "agil2025",
      pin: "5937",
    }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("rechaza formato trivial antes de llamar a Auth", async () => {
    const { client, pin } = makeClient();
    render(<PinSetupDialog client={client} />);

    fireEvent.change(screen.getByLabelText("Contraseña actual"), {
      target: { value: "agil2025" },
    });
    fireEvent.change(screen.getByLabelText("PIN de 4 a 6 dígitos"), {
      target: { value: "1234" },
    });
    fireEvent.change(screen.getByLabelText("Repetir PIN"), {
      target: { value: "1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar PIN" }));

    expect((await screen.findByRole("alert")).textContent).toContain("secuencia trivial");
    expect(pin.set).not.toHaveBeenCalled();
  });

  it("muestra error de contraseña incorrecta", async () => {
    const { client, pin } = makeClient();
    pin.set.mockRejectedValue({ body: { error: "password_incorrecta" } });
    render(<PinSetupDialog client={client} />);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Guardar PIN" }));

    expect((await screen.findByRole("alert")).textContent).toContain("contraseña actual es incorrecta");
  });
});
