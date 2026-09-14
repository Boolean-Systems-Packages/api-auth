import React, { useEffect, useId, useState } from "react";
import type {
  AdminAuthPromptLabels,
  RequestAdminAuthorizationInput,
  RequestAdminAuthorizationResult,
  VerifyCredentialsPayload,
} from "../admin-auth";
import { adminAuthPromptStyles } from "./AdminAuthPrompt.styles";

const DEFAULT_LABELS: Required<AdminAuthPromptLabels> = {
  title: "Autorización de administrador",
  description:
    "Ingresá usuario y clave de un administrador de esta empresa para continuar. No se abre una sesión para esa persona.",
  username: "Usuario",
  password: "Clave",
  confirm: "Autorizar",
  cancel: "Cancelar",
  invalid: "Las credenciales no son válidas o esa persona no es administrador de esta empresa.",
};

export type AdminAuthPromptClient = {
  verifyCredentials: {
    requestAdminAuthorization: (
      payload: VerifyCredentialsPayload
    ) => Promise<RequestAdminAuthorizationResult>;
  };
};

export type AdminAuthPromptProps = {
  open: boolean;
  action: string;
  client?: AdminAuthPromptClient | undefined;
  companyId?: string | undefined;
  actorUserId?: string | undefined;
  authorize?: (
    input: RequestAdminAuthorizationInput
  ) => Promise<RequestAdminAuthorizationResult>;
  onAuthorized: (result?: RequestAdminAuthorizationResult) => void;
  onCancel: () => void;
  labels?: AdminAuthPromptLabels | undefined;
};

export function AdminAuthPrompt({
  open,
  action,
  client,
  companyId,
  actorUserId,
  authorize,
  onAuthorized,
  onCancel,
  labels,
}: AdminAuthPromptProps) {
  const formId = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const text = { ...DEFAULT_LABELS, ...labels };

  useEffect(() => {
    if (!open) {
      setUsername("");
      setPassword("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const input = { username: username.trim(), password, action };
    try {
      const verify = authorize
        ? authorize
        : client && companyId
          ? (payload: RequestAdminAuthorizationInput) =>
              client.verifyCredentials.requestAdminAuthorization({
                ...payload,
                companyId,
                ...(actorUserId !== undefined ? { actorUserId } : {}),
              })
          : null;
      if (!verify) {
        onAuthorized({ authorized: true });
        return;
      }
      const result = await verify(input);
      if (!result.authorized) {
        setError(text.invalid);
        return;
      }
      onAuthorized(result);
    } catch {
      setError(text.invalid);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="api-auth-prompt__overlay" role="presentation">
      <style>{adminAuthPromptStyles}</style>
      <div
        className="api-auth-prompt__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
      >
        <h2 className="api-auth-prompt__title" id={`${formId}-title`}>
          {text.title}
        </h2>
        <p className="api-auth-prompt__description">{text.description}</p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="api-auth-prompt__field">
            <label htmlFor={`${formId}-username`}>{text.username}</label>
            <input
              id={`${formId}-username`}
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="api-auth-prompt__field">
            <label htmlFor={`${formId}-password`}>{text.password}</label>
            <input
              id={`${formId}-password`}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? <p className="api-auth-prompt__error">{error}</p> : null}
          <div className="api-auth-prompt__actions">
            <button
              type="button"
              className="api-auth-prompt__cancel"
              onClick={onCancel}
              disabled={submitting}
            >
              {text.cancel}
            </button>
            <button type="submit" className="api-auth-prompt__confirm" disabled={submitting}>
              {text.confirm}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
