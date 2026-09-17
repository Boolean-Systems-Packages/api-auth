import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { AuthClient } from "../client";

export interface InactivityPinLockLabels {
  title: string;
  userPrompt: string;
  pinLabel: string;
  unlock: string;
  logout: string;
  noPin: string;
  invalidPin: (remainingAttempts?: number) => string;
  locked: (lockedUntil?: string) => string;
  throttled: string;
  sessionExpired: string;
  verificationError: string;
  showPin?: string;
  hidePin?: string;
}

export interface InactivityPinLockProps {
  client: AuthClient;
  identityKey: string;
  lockAfterMs: number;
  closeAfterMs?: number | undefined;
  hasPin: boolean;
  userLabel?: string | undefined;
  onBeforeClose?: (() => Promise<void>) | undefined;
  onLogout: () => void | Promise<void>;
  onSessionExpired?: (() => void) | undefined;
  labels?: Partial<InactivityPinLockLabels> | undefined;
  children?: ReactNode;
}

const DEFAULT_LABELS: InactivityPinLockLabels = {
  title: "Pantalla bloqueada",
  userPrompt: "Ingresá tu PIN para desbloquear la pantalla y continuar trabajando.",
  pinLabel: "PIN",
  unlock: "Confirmar PIN",
  logout: "Cerrar sesión",
  noPin: "Este usuario no tiene un PIN configurado.",
  invalidPin: (remainingAttempts) =>
    remainingAttempts === undefined
      ? "PIN incorrecto."
      : `PIN incorrecto. Intentos restantes: ${remainingAttempts}.`,
  locked: (lockedUntil) =>
    lockedUntil
      ? `El PIN está bloqueado hasta ${formatDate(lockedUntil)}.`
      : "El PIN está bloqueado temporalmente.",
  throttled: "Demasiados intentos. Esperá un momento y probá de nuevo.",
  sessionExpired: "La sesión venció. Cerrá sesión para volver a ingresar.",
  verificationError: "No se pudo verificar el PIN. Probá nuevamente.",
  showPin: "Mostrar PIN",
  hidePin: "Ocultar PIN",
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
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

const userLabelStyle: CSSProperties = {
  margin: "10px 0 0",
  color: "#cbd5e1",
  fontSize: "14px",
  overflowWrap: "anywhere",
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  marginTop: "24px",
};

const promptStyle: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  fontSize: "14px",
  lineHeight: 1.5,
  textAlign: "left",
};

const fieldLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  fontSize: "14px",
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  border: "1px solid #9ca3af",
  borderRadius: "6px",
  background: "#fff",
  color: "#111827",
  fontSize: "20px",
  letterSpacing: "0.3em",
  minHeight: "48px",
  padding: "10px 12px",
  textAlign: "left",
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

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: "6px",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  width: "100%",
  minHeight: "44px",
  padding: "10px 16px",
  fontSize: "15px",
  fontWeight: 600,
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #9ca3af",
  borderRadius: "6px",
  background: "transparent",
  color: "#f9fafb",
  cursor: "pointer",
  width: "100%",
  minHeight: "44px",
  marginTop: "12px",
  padding: "10px 16px",
  fontSize: "15px",
  fontWeight: 600,
};

export function InactivityPinLock({
  client,
  identityKey,
  lockAfterMs,
  closeAfterMs,
  hasPin,
  userLabel,
  onBeforeClose,
  onLogout,
  onSessionExpired,
  labels,
  children,
}: InactivityPinLockProps) {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const [locked, setLocked] = useState(false);
  const [pinAvailable, setPinAvailable] = useState(hasPin);
  const [pinBlocked, setPinBlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const verificationGeneration = useRef(0);
  const callbackRefs = useRef({ onBeforeClose, onLogout, onSessionExpired });

  callbackRefs.current = { onBeforeClose, onLogout, onSessionExpired };

  useEffect(() => {
    setPinAvailable(hasPin);
  }, [hasPin, identityKey]);

  useEffect(() => {
    verificationGeneration.current += 1;
    setLocked(false);
    setPin("");
    setPinBlocked(false);
    setMessage(null);
    setBusy(false);
    setShowPin(false);
    setSessionExpired(false);
  }, [identityKey]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const host = document.createElement("div");
    host.dataset.apiAuthPinLock = "true";
    document.body.appendChild(host);
    hostRef.current = host;
    return () => {
      host.remove();
      hostRef.current = null;
    };
  }, []);

  useEffect(() => {
    const graceMs = closeAfterMs !== undefined && closeAfterMs > 0
      ? closeAfterMs
      : undefined;

    client.inactivity.start({
      warnAfterMs: lockAfterMs,
      ...(graceMs !== undefined ? { graceMs } : {}),
      onWarning: () => {
        setSessionExpired(false);
        setMessage(null);
        setPin("");
        setPinBlocked(false);
        setShowPin(false);
        setLocked(true);
      },
      ...(graceMs !== undefined && onBeforeClose
        ? {
            beforeLogout: () =>
              callbackRefs.current.onBeforeClose?.() ?? Promise.resolve(),
          }
        : {}),
      onSessionExpired: () => {
        verificationGeneration.current += 1;
        setSessionExpired(true);
        setLocked(true);
        callbackRefs.current.onSessionExpired?.();
      },
    });

    return () => client.inactivity.stop();
  }, [client, identityKey, lockAfterMs, closeAfterMs]);

  useEffect(() => {
    const host = hostRef.current;
    if (!locked || !host || typeof document === "undefined") return;

    const previous = Array.from(document.body.children)
      .filter((element) => element !== host)
      .map((element) => ({
        element,
        hadInert: element.hasAttribute("inert"),
        hadAriaHidden: element.hasAttribute("aria-hidden"),
        ariaHidden: element.getAttribute("aria-hidden"),
        visibility: element instanceof HTMLElement ? element.style.visibility : "",
      }));
    const previousOverflow = document.body.style.overflow;

    for (const item of previous) {
      item.element.setAttribute("inert", "");
      item.element.setAttribute("aria-hidden", "true");
      if (item.element instanceof HTMLElement) item.element.style.visibility = "hidden";
    }
    document.body.style.overflow = "hidden";

    return () => {
      for (const item of previous) {
        if (!item.hadInert) item.element.removeAttribute("inert");
        if (item.hadAriaHidden) {
          item.element.setAttribute("aria-hidden", item.ariaHidden ?? "");
        } else {
          item.element.removeAttribute("aria-hidden");
        }
        if (item.element instanceof HTMLElement) item.element.style.visibility = item.visibility;
      }
      document.body.style.overflow = previousOverflow;
    };
  }, [locked]);

  useEffect(() => {
    if (!locked) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled])"
        )
      );
    const firstFocusable = () => focusables()[0]?.focus();
    firstFocusable();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        if (event.key === "Escape") event.preventDefault();
        return;
      }
      const elements = focusables();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }
      const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0 ? elements.length - 1 : currentIndex - 1
        : currentIndex === elements.length - 1 ? 0 : currentIndex + 1;
      event.preventDefault();
      elements[nextIndex]?.focus();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) firstFocusable();
    };

    dialog.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [locked, pinAvailable, pinBlocked, sessionExpired, busy]);

  const logout = useCallback(() => {
    verificationGeneration.current += 1;
    client.inactivity.stop();
    void Promise.resolve(callbackRefs.current.onLogout()).catch(() => undefined);
  }, [client]);

  const verifyPin = useCallback(async () => {
    if (!pinAvailable || pinBlocked || sessionExpired || busy) return;
    const requestGeneration = verificationGeneration.current;
    setBusy(true);
    setMessage(null);
    try {
      const response = await client.pin.verify({ pin });
      if (requestGeneration !== verificationGeneration.current) return;
      const result = response.data;
      if (result.valid) {
        setPin("");
        setShowPin(false);
        setMessage(null);
        setLocked(false);
        client.inactivity.confirmActive();
      } else if (result.reason === "bloqueado") {
        setPinBlocked(true);
        setMessage(mergedLabels.locked(result.lockedUntil));
      } else if (result.reason === "sin_pin") {
        setPinAvailable(false);
        setMessage(mergedLabels.noPin);
      } else if (result.reason === "throttle") {
        setMessage(mergedLabels.throttled);
      } else {
        setMessage(mergedLabels.invalidPin(result.remainingAttempts));
      }
    } catch (error) {
      if (requestGeneration !== verificationGeneration.current) return;
      if (getHttpStatus(error) === 401) {
        setSessionExpired(true);
        setMessage(mergedLabels.sessionExpired);
      } else {
        setMessage(mergedLabels.verificationError);
      }
    } finally {
      if (requestGeneration === verificationGeneration.current) setBusy(false);
    }
  }, [busy, client, mergedLabels, pin, pinAvailable, pinBlocked, sessionExpired]);

  const portal = locked && hostRef.current
    ? createPortal(
        <div style={overlayStyle} data-testid="inactivity-pin-lock">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-auth-pin-lock-title"
            style={cardStyle}
          >
            <h1 id="api-auth-pin-lock-title" style={titleStyle}>
              {mergedLabels.title}
            </h1>
            {userLabel ? <p style={userLabelStyle}>{userLabel}</p> : null}
            {sessionExpired ? (
              <p role="alert">{mergedLabels.sessionExpired}</p>
            ) : pinAvailable && !pinBlocked ? (
              <form
                style={formStyle}
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyPin();
                }}
              >
                <p style={promptStyle}>{mergedLabels.userPrompt}</p>
                <label style={fieldLabelStyle}>
                  {mergedLabels.pinLabel}
                  <div style={inputWrapperStyle}>
                    <input
                      value={pin}
                      onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      type={showPin ? "text" : "password"}
                      autoComplete="off"
                      maxLength={6}
                      pattern="[0-9]{4,6}"
                      required
                      style={inputStyle}
                      aria-describedby={message ? "api-auth-pin-lock-message" : undefined}
                    />
                    <VisibilityToggle
                      visible={showPin}
                      onClick={() => setShowPin((current) => !current)}
                      showLabel={mergedLabels.showPin ?? "Mostrar PIN"}
                      hideLabel={mergedLabels.hidePin ?? "Ocultar PIN"}
                    />
                  </div>
                </label>
                {message ? (
                  <p id="api-auth-pin-lock-message" role="alert">
                    {message}
                  </p>
                ) : null}
                <button type="submit" disabled={busy} style={primaryButtonStyle}>
                  {busy ? "..." : mergedLabels.unlock}
                </button>
              </form>
            ) : pinBlocked ? (
              <p role="alert">{message ?? mergedLabels.locked()}</p>
            ) : (
              <p role="alert">{mergedLabels.noPin}</p>
            )}
            <button type="button" onClick={logout} style={secondaryButtonStyle}>
              {mergedLabels.logout}
            </button>
          </div>
        </div>,
        hostRef.current
      )
    : null;

  return (
    <>
      {children}
      {portal}
    </>
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

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
