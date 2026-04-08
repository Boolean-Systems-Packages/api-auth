/**
 * Ejemplo 2: Refresh automático de tokens
 *
 * Un patrón muy común: si el accessToken expiró, renovarlo automáticamente
 * antes de que el usuario vea un error.
 *
 * Se implementa con un interceptor de response de @boolean-systems-packages/http.
 * La lógica de refresh vive en el consumer, no en el SDK.
 */

import { createAuthClient } from "@boolean-systems-packages/api-auth";
import { UnauthorizedError } from "@boolean-systems-packages/http";

// ─────────────────────────────────────────────
// Token store (simplificado — en producción usarías un estado global)
// ─────────────────────────────────────────────

let accessToken = localStorage.getItem("access_token") ?? "";
let refreshToken = localStorage.getItem("refresh_token") ?? "";

function saveTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

function clearTokens() {
  accessToken = "";
  refreshToken = "";
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

// ─────────────────────────────────────────────
// Crear el cliente base
// ─────────────────────────────────────────────

const auth = createAuthClient({
  baseURL: "https://api.boolean.com.ar/auth",
  getAuthHeader: () => `Bearer ${accessToken}`,
});

// ─────────────────────────────────────────────
// Refresh automático vía interceptor
// ─────────────────────────────────────────────

// Flag para evitar loops infinitos si el refresh también falla
let isRefreshing = false;

auth.httpClient.addResponseInterceptor(async (ctx) => {
  // Solo actuamos en 401
  if (ctx.response.status !== 401) return ctx;

  // Si ya estamos intentando refrescar → no reintentar (loop)
  if (isRefreshing) {
    clearTokens();
    // Dejar que el error 401 se propague
    return ctx;
  }

  if (!refreshToken) {
    // No hay refresh token → sesión expirada definitivamente
    clearTokens();
    return ctx;
  }

  isRefreshing = true;

  try {
    // Usar el método del SDK para renovar tokens
    const newTokens = await auth.sessions.refresh({ refreshToken });
    saveTokens(newTokens.accessToken, newTokens.refreshToken);

    // Reintentar el request original con el nuevo token
    const retryResponse = await auth.httpClient.request({
      ...ctx.requestContext.options,
      headers: {
        ...ctx.requestContext.options.headers,
        Authorization: `Bearer ${newTokens.accessToken}`,
      },
    });

    return {
      ...ctx,
      response: retryResponse,
    };
  } catch {
    // El refresh falló → cerrar sesión
    clearTokens();
    return ctx;
  } finally {
    isRefreshing = false;
  }
});

// ─────────────────────────────────────────────
// Uso normal — el refresh es transparente
// ─────────────────────────────────────────────

async function example() {
  try {
    // Si el accessToken expiró, el interceptor lo renueva automáticamente
    // antes de que este código vea el error
    const me = await auth.me.get();
    console.log("Usuario:", me.email);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      // Solo llega aquí si el refresh también falló
      console.log("Sesión expirada. Redirigiendo a login...");
      window.location.href = "/login";
    }
  }
}
