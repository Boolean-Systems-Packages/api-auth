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
