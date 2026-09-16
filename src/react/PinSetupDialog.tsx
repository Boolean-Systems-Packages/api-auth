import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { AuthClient } from "../client";

export interface PinSetupDialogLabels {
  title: string;
  currentPassword: string;
  pin: string;
  confirmation: string;
  save: string;
  cancel: string;
  invalidPin: string;
  confirmationMismatch: string;
  incorrectPassword: string;
  saveError: string;
}

export interface PinSetupDialogProps {
  client: AuthClient;
  open?: boolean | undefined;
  onDone?: (() => void) | undefined;
  onCancel?: (() => void) | undefined;
  labels?: Partial<PinSetupDialogLabels> | undefined;
}

const DEFAULT_LABELS: PinSetupDialogLabels = {
  title: "Configurar PIN",
  currentPassword: "Contraseña actual",
  pin: "PIN de 4 a 6 dígitos",
  confirmation: "Repetir PIN",
  save: "Guardar PIN",
  cancel: "Cancelar",
  invalidPin: "El PIN debe tener 4 a 6 dígitos y no puede ser una secuencia trivial.",
  confirmationMismatch: "Los PIN no coinciden.",
  incorrectPassword: "La contraseña actual es incorrecta.",
  saveError: "No se pudo guardar el PIN. Probá nuevamente.",
};

const panelStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483646,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgb(17 24 39 / 60%)",
  padding: "24px",
};

const cardStyle: CSSProperties = {
  width: "min(100%, 440px)",
  borderRadius: "12px",
  background: "#fff",
  color: "#111827",
  padding: "32px",
  boxShadow: "0 24px 80px rgb(0 0 0 / 35%)",
};

const fieldStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "block",
  width: "100%",
  marginTop: "6px",
  marginBottom: "16px",
  border: "1px solid #9ca3af",
  borderRadius: "6px",
  padding: "10px 12px",
};

export function PinSetupDialog({
  client,
  open = true,
  onDone,
  onCancel,
  labels,
}: PinSetupDialogProps) {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const [currentPassword, setCurrentPassword] = useState("");
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>("input, button:not([disabled])"));
    focusables()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusables();
      if (elements.length === 0) return;
      const index = elements.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? index <= 0 ? elements.length - 1 : index - 1
        : index === elements.length - 1 ? 0 : index + 1;
      event.preventDefault();
      elements[next]?.focus();
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [open, busy]);

  if (!open || typeof document === "undefined") return null;

  const save = async () => {
    setError(null);
    if (!isValidPin(pin)) {
      setError(mergedLabels.invalidPin);
      return;
    }
    if (pin !== confirmation) {
      setError(mergedLabels.confirmationMismatch);
      return;
    }

    setBusy(true);
    try {
      await client.pin.set({ currentPassword, pin });
      setCurrentPassword("");
      setPin("");
      setConfirmation("");
      onDone?.();
    } catch (requestError) {
      const code = getErrorCode(requestError);
      setError(code === "password_incorrecta"
        ? mergedLabels.incorrectPassword
        : code === "pin_invalido"
          ? mergedLabels.invalidPin
          : mergedLabels.saveError);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div style={panelStyle} data-testid="pin-setup-dialog">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-auth-pin-setup-title"
        style={cardStyle}
      >
        <h1 id="api-auth-pin-setup-title">{mergedLabels.title}</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label>
            {mergedLabels.currentPassword}
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              style={fieldStyle}
              required
            />
          </label>
          <label>
            {mergedLabels.pin}
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              style={fieldStyle}
              required
            />
          </label>
          <label>
            {mergedLabels.confirmation}
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, "").slice(0, 6))}
              style={fieldStyle}
              required
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={busy}>
            {busy ? "..." : mergedLabels.save}
          </button>
          {onCancel ? (
            <button type="button" onClick={onCancel}>
              {mergedLabels.cancel}
            </button>
          ) : null}
        </form>
      </div>
    </div>,
    document.body
  );
}

function isValidPin(pin: string): boolean {
  if (!/^\d{4,6}$/.test(pin)) return false;
  if (/^(\d)\1+$/.test(pin)) return false;
  const digits = [...pin].map(Number);
  const delta = digits[1]! - digits[0]!;
  const isSequence = (delta === 1 || delta === -1) && digits.every(
    (digit, index) => index === 0 || digit - digits[index - 1]! === delta
  );
  return !isSequence;
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const body = (error as { body?: unknown }).body;
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (typeof nested.error === "string") return nested.error;
  }
  return undefined;
}
