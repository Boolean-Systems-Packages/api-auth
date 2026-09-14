/**
 * Ejemplo 5: Modal de autorización de admin
 *
 * El usuario logueado sigue en su sesión. Un admin pone usuario y clave
 * en el mismo terminal; se desbloquea ESA acción. No se abre una sesión
 * para el admin.
 *
 * El front NO llama a Auth. Manda las credenciales al backend del micro;
 * ese backend verifica con Auth (M2M) y ejecuta la acción.
 */

import { useState } from "react";
import { AdminAuthPrompt } from "@boolean-systems-packages/api-auth/react";
import type { RequestAdminAuthorizationInput } from "@boolean-systems-packages/api-auth/react";

type ConfirmPayload = {
  admin_username: string;
  admin_password: string;
};

export function SensitiveActionButton({
  requireAdminAuth,
  sessionUserIsAdmin,
  confirmAction,
}: {
  requireAdminAuth: boolean;
  sessionUserIsAdmin: boolean;
  confirmAction: (payload?: ConfirmPayload) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (requireAdminAuth && !sessionUserIsAdmin) {
      setOpen(true);
      return;
    }
    setBusy(true);
    try {
      await confirmAction();
    } finally {
      setBusy(false);
    }
  }

  async function authorize({ username, password }: RequestAdminAuthorizationInput) {
    try {
      await confirmAction({
        admin_username: username,
        admin_password: password,
      });
      return { authorized: true };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "ADMIN_AUTH_INVALID" || code === "ADMIN_AUTH_REQUIRED") {
        return { authorized: false };
      }
      throw error;
    }
  }

  return (
    <>
      <button type="button" onClick={() => void handleClick()} disabled={busy}>
        Emitir nota de crédito
      </button>
      <AdminAuthPrompt
        open={open}
        action="emit_nc"
        authorize={authorize}
        onAuthorized={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
