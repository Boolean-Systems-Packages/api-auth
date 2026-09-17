import type { TokenPair } from "./types";

/**
 * Auth v2 devuelve los tokens como `access` y `refresh`, mientras que el
 * contrato tipado del SDK usa nombres explícitos para evitar ambigüedad.
 * Se aceptan ambos formatos para mantener compatibilidad con otros hosts.
 */
export interface RawTokenPair {
  accessToken?: string;
  refreshToken?: string;
  access?: string;
  refresh?: string;
  expiresIn?: number;
  expires_in?: number;
}

export function normalizeTokenPair(payload: RawTokenPair): TokenPair {
  const accessToken = payload.accessToken ?? payload.access;
  const refreshToken = payload.refreshToken ?? payload.refresh;

  if (!accessToken || !refreshToken) {
    throw new Error("La respuesta de refresh no contiene access ni refresh");
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: payload.expiresIn ?? payload.expires_in ?? 0,
  };
}
