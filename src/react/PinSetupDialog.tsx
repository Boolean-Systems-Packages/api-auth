import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { AuthClient } from "../client";

export interface PinSetupDialogLabels {
  title: string;
  description?: string;
  currentPassword: string;
  pin: string;
  confirmation: string;
  save: string;
  cancel: string;
  invalidPin: string;
  confirmationMismatch: string;
  incorrectPassword: string;
  saveError: string;
  showSecret?: string;
  hideSecret?: string;
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
  description:
    "El PIN permite desbloquear rápidamente la pantalla después de un período de inactividad, sin cerrar tu sesión. Elegí un PIN personal que puedas recordar y no compartas.",
  currentPassword: "Contraseña actual",
  pin: "PIN de 4 a 6 dígitos",
  confirmation: "Repetir PIN",
  save: "Guardar PIN",
  cancel: "Cancelar",
  invalidPin: "El PIN debe tener 4 a 6 dígitos y no puede ser una secuencia trivial.",
  confirmationMismatch: "Los PIN no coinciden.",
  incorrectPassword: "La contraseña actual es incorrecta.",
  saveError: "No se pudo guardar el PIN. Probá nuevamente.",
  showSecret: "Mostrar",
  hideSecret: "Ocultar",
};

const panelStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483646,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#111827",
  color: "#f9fafb",
  padding: "24px",
};

const cardStyle: CSSProperties = {
  width: "min(100%, 420px)",
  borderRadius: "12px",
  background: "#1f2937",
  padding: "32px",
  boxShadow: "0 24px 80px rgb(0 0 0 / 45%)",
  textAlign: "left",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "24px",
  lineHeight: 1.25,
};

const descriptionStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#cbd5e1",
  fontSize: "14px",
  lineHeight: 1.5,
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  marginTop: "24px",
};

const fieldLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  color: "#f9fafb",
  fontSize: "14px",
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: "48px",
  border: "1px solid #64748b",
  borderRadius: "6px",
  background: "#fff",
  color: "#111827",
  fontSize: "16px",
  padding: "10px 12px",
};

const inputWithToggleStyle: CSSProperties = {
  ...inputStyle,
  paddingRight: "52px",
};

const pinInputStyle: CSSProperties = {
  ...inputStyle,
  fontSize: "20px",
  letterSpacing: "0.3em",
  textAlign: "left",
};

const pinInputWithToggleStyle: CSSProperties = {
  ...pinInputStyle,
  paddingRight: "52px",
};

const inputWrapperStyle: CSSProperties = {
  position: "relative",
};

const visibilityButtonStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: "8px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "36px",
  height: "36px",
  transform: "translateY(-50%)",
  border: 0,
  borderRadius: "6px",
  background: "transparent",
  color: "#334155",
  cursor: "pointer",
  padding: 0,
};

const errorStyle: CSSProperties = {
  margin: 0,
  borderRadius: "6px",
  background: "rgb(127 29 29 / 45%)",
  color: "#fecaca",
  padding: "10px 12px",
  fontSize: "14px",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  marginTop: "4px",
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  border: 0,
  borderRadius: "6px",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  padding: "10px 16px",
  fontSize: "15px",
  fontWeight: 600,
};

const secondaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  border: "1px solid #9ca3af",
  borderRadius: "6px",
  background: "transparent",
  color: "#f9fafb",
  cursor: "pointer",
  padding: "10px 16px",
  fontSize: "15px",
  fontWeight: 600,
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
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const resetSecrets = useCallback(() => {
    setCurrentPassword("");
    setPin("");
    setConfirmation("");
    setError(null);
    setShowPassword(false);
    setShowPin(false);
    setShowConfirmation(false);
  }, []);

  useEffect(() => {
    if (!open) resetSecrets();
  }, [open, resetSecrets]);

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
        <h1 id="api-auth-pin-setup-title" style={titleStyle}>
          {mergedLabels.title}
        </h1>
        <p style={descriptionStyle}>{mergedLabels.description}</p>
        <form
          style={formStyle}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label style={fieldLabelStyle}>
            {mergedLabels.currentPassword}
            <div style={inputWrapperStyle}>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                style={inputWithToggleStyle}
                required
              />
              <VisibilityToggle
                visible={showPassword}
                onClick={() => setShowPassword((current) => !current)}
                showLabel={`${mergedLabels.showSecret} ${mergedLabels.currentPassword}`}
                hideLabel={`${mergedLabels.hideSecret} ${mergedLabels.currentPassword}`}
              />
            </div>
          </label>
          <label style={fieldLabelStyle}>
            {mergedLabels.pin}
            <div style={inputWrapperStyle}>
              <input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                style={pinInputWithToggleStyle}
                required
              />
              <VisibilityToggle
                visible={showPin}
                onClick={() => setShowPin((current) => !current)}
                showLabel={`${mergedLabels.showSecret} ${mergedLabels.pin}`}
                hideLabel={`${mergedLabels.hideSecret} ${mergedLabels.pin}`}
              />
            </div>
          </label>
          <label style={fieldLabelStyle}>
            {mergedLabels.confirmation}
            <div style={inputWrapperStyle}>
              <input
                type={showConfirmation ? "text" : "password"}
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, "").slice(0, 6))}
                style={pinInputWithToggleStyle}
                required
              />
              <VisibilityToggle
                visible={showConfirmation}
                onClick={() => setShowConfirmation((current) => !current)}
                showLabel={`${mergedLabels.showSecret} ${mergedLabels.confirmation}`}
                hideLabel={`${mergedLabels.hideSecret} ${mergedLabels.confirmation}`}
              />
            </div>
          </label>
          {error ? <p role="alert" style={errorStyle}>{error}</p> : null}
          <div style={actionsStyle}>
            <button type="submit" disabled={busy} style={primaryButtonStyle}>
              {busy ? "..." : mergedLabels.save}
            </button>
            {onCancel ? (
              <button
                type="button"
                onClick={() => {
                  resetSecrets();
                  onCancel();
                }}
                style={secondaryButtonStyle}
              >
                {mergedLabels.cancel}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function VisibilityToggle({
  visible,
  onClick,
  showLabel,
  hideLabel,
}: {
  visible: boolean;
  onClick: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <button
      type="button"
      style={visibilityButtonStyle}
      onClick={onClick}
      aria-label={visible ? hideLabel : showLabel}
      title={visible ? hideLabel : showLabel}
      aria-pressed={visible}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {visible ? (
          <>
            <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.6 5.2 9.5 7-.3.6-.9 1.6-1.8 2.7M6.2 6.2C3.8 7.8 2.7 10.4 2.5 12c.9 1.8 4.3 7 9.5 7 1.2 0 2.3-.3 3.3-.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
          </>
        )}
      </svg>
    </button>
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
