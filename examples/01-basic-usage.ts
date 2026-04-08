/**
 * Ejemplo 1: Configuración básica
 *
 * La forma más simple de crear e instanciar el cliente.
 * Útil para entender el flujo completo sin nada extra.
 */

import { createAuthClient } from "@boolean-systems-packages/api-auth";
import { UnauthorizedError, NotFoundError } from "@boolean-systems-packages/http";

// ─────────────────────────────────────────────
// 1. Crear el cliente
// ─────────────────────────────────────────────

const auth = createAuthClient({
  baseURL: "https://api.boolean.com.ar/auth",

  // getAuthHeader se llama en CADA request, así siempre usa el token más fresco
  getAuthHeader: () => {
    const token = localStorage.getItem("access_token");
    return `Bearer ${token ?? ""}`;
  },
});

// ─────────────────────────────────────────────
// 2. Login
// ─────────────────────────────────────────────

async function login(email: string, password: string) {
  // No necesitás pensar en URLs, headers ni fetch.
  // Solo llamás al método con el payload tipado.
  const session = await auth.sessions.login({ email, password });

  // session.tokens tiene accessToken y refreshToken
  // session.user tiene id, email, firstName, lastName, roles

  // Guardar tokens (la lógica de almacenamiento es tuya, no del SDK)
  localStorage.setItem("access_token", session.tokens.accessToken);
  localStorage.setItem("refresh_token", session.tokens.refreshToken);

  return session.user;
}

// ─────────────────────────────────────────────
// 3. Obtener perfil del usuario
// ─────────────────────────────────────────────

async function getProfile() {
  // El token se inyecta automáticamente (via getAuthHeader)
  const user = await auth.me.get();
  console.log(`Hola, ${user.firstName}!`);
  return user;
}

// ─────────────────────────────────────────────
// 4. Manejo de errores tipados
// ─────────────────────────────────────────────

async function loginConManejo(email: string, password: string) {
  try {
    return await auth.sessions.login({ email, password });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      // Credenciales incorrectas
      console.error("Email o contraseña inválidos");
      return null;
    }
    // Cualquier otro error lo dejamos subir
    throw error;
  }
}

// ─────────────────────────────────────────────
// 5. Logout
// ─────────────────────────────────────────────

async function logout() {
  await auth.sessions.logout();

  // Limpiar tokens locales
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}
