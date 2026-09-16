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
  userPrompt: "Ingresá tu PIN para continuar",
  pinLabel: "PIN",
  unlock: "Destrabar",
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
  padding: "10px 12px",
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: "6px",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  padding: "10px 16px",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #9ca3af",
  borderRadius: "6px",
  background: "transparent",
  color: "#f9fafb",
  cursor: "pointer",
  padding: "10px 16px",
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
  const [sessionExpired, setSessionExpired] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const callbackRefs = useRef({ onBeforeClose, onLogout, onSessionExpired });

  callbackRefs.current = { onBeforeClose, onLogout, onSessionExpired };

  useEffect(() => {
    setPinAvailable(hasPin);
  }, [hasPin, identityKey]);

  useEffect(() => {
    setLocked(false);
    setPin("");
    setPinBlocked(false);
    setMessage(null);
    setBusy(false);
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
        setLocked(true);
      },
      ...(graceMs !== undefined && onBeforeClose
        ? {
            beforeLogout: () =>
              callbackRefs.current.onBeforeClose?.() ?? Promise.resolve(),
          }
        : {}),
      onSessionExpired: () => {
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
    client.inactivity.stop();
    void Promise.resolve(callbackRefs.current.onLogout()).catch(() => undefined);
  }, [client]);

  const verifyPin = useCallback(async () => {
    if (!pinAvailable || pinBlocked || sessionExpired || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await client.pin.verify({ pin });
      const result = response.data;
      if (result.valid) {
        setPin("");
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
      if (getHttpStatus(error) === 401) {
        setSessionExpired(true);
        setMessage(mergedLabels.sessionExpired);
      } else {
        setMessage(mergedLabels.verificationError);
      }
    } finally {
      setBusy(false);
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
            <h1 id="api-auth-pin-lock-title" style={{ marginTop: 0 }}>
              {mergedLabels.title}
            </h1>
            {userLabel ? <p>{userLabel}</p> : null}
            {sessionExpired ? (
              <p role="alert">{mergedLabels.sessionExpired}</p>
            ) : pinAvailable && !pinBlocked ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyPin();
                }}
              >
                <p>{mergedLabels.userPrompt}</p>
                <label>
                  {mergedLabels.pinLabel}
                  <input
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    type="password"
                    autoComplete="off"
                    maxLength={6}
                    pattern="[0-9]{4,6}"
                    required
                    style={inputStyle}
                    aria-describedby={message ? "api-auth-pin-lock-message" : undefined}
                  />
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

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}
