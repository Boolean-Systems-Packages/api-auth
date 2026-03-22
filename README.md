# @boolean/api-auth

> SDK del microservicio de autenticación Boolean.
> Construido sobre `@boolean/http`.

---

## ¿Qué hace?

`@boolean/api-auth` encapsula **todos los endpoints del servicio de autenticación** en métodos tipados y con nombre semántico. No hay URLs, no hay fetch, no hay headers.

```ts
// ❌ Antes (cada dev lo resolvía distinto)
const res = await fetch(`${BASE_URL}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ email, password }),
});
const data = await res.json();

// ✅ Ahora
const session = await auth.sessions.login({ email, password });
```

---

## Instalación

```bash
# Dentro del monorepo — workspace protocol
# El package.json ya tiene "@boolean/http": "workspace:*"
```

---

## Uso rápido

```ts
import { createAuthClient } from "@boolean/api-auth";

const auth = createAuthClient({
  baseURL: "https://api.boolean.com.ar/auth",
  getAuthHeader: () => `Bearer ${localStorage.getItem("access_token")}`,
});

// Login
const session = await auth.sessions.login({ email, password });

// Perfil
const me = await auth.me.get();

// Logout
await auth.sessions.logout();
```

---

## API

### `auth.sessions`

| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| `login(payload)` | `POST /sessions` | ❌ | Login con email + password |
| `register(payload)` | `POST /sessions/register` | ❌ | Registro de usuario |
| `refresh(payload)` | `POST /sessions/refresh` | ❌ | Renovar accessToken |
| `logout()` | `DELETE /sessions` | ✅ | Cerrar sesión |

### `auth.me`

| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| `get()` | `GET /me` | ✅ | Perfil del usuario autenticado |
| `update(payload)` | `PATCH /me` | ✅ | Actualizar nombre/apellido |
| `changePassword(payload)` | `POST /me/change-password` | ✅ | Cambiar contraseña |
| `deleteAccount()` | `DELETE /me` | ✅ | Eliminar cuenta |

### `auth.passwordRecovery`

| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| `forgot(payload)` | `POST /password-recovery/forgot` | ❌ | Enviar email de recuperación |
| `reset(payload)` | `POST /password-recovery/reset` | ❌ | Resetear contraseña con token |

---

## Configuración

```ts
createAuthClient({
  // REQUERIDO: URL base del servicio auth, sin trailing slash
  baseURL: "https://api.boolean.com.ar/auth",

  // REQUERIDO: función que retorna el token actual
  // Se llama en cada request para siempre tener el token más fresco
  getAuthHeader: () => `Bearer ${localStorage.getItem("access_token")}`,

  // OPCIONAL: timeout en ms (default: 15000)
  timeout: 10_000,
});
```

---

## Ejemplos

| Archivo | Qué muestra |
|---|---|
| [`01-basic-usage.ts`](./examples/01-basic-usage.ts) | Login, perfil, logout básico |
| [`02-auto-refresh.ts`](./examples/02-auto-refresh.ts) | Renovación silenciosa de tokens con interceptors |
| [`03-react-integration.tsx`](./examples/03-react-integration.tsx) | AuthProvider, useAuth hook, LoginForm |
| [`04-building-other-sdks.ts`](./examples/04-building-other-sdks.ts) | Cómo crear `@boolean/api-inventory` siguiendo el mismo patrón |

---

## Manejo de errores

Los errores vienen de `@boolean/http` — la misma jerarquía aplica acá:

```ts
import { UnauthorizedError, ValidationError, NetworkError } from "@boolean/http";

try {
  await auth.sessions.login({ email, password });
} catch (error) {
  if (error instanceof UnauthorizedError) {
    // 401 → credenciales incorrectas
  } else if (error instanceof ValidationError) {
    // 422 → body rechazado por el servidor (error.body tiene los detalles)
  } else if (error instanceof NetworkError) {
    // Sin conexión
  }
}
```

---

## Interceptors avanzados

El cliente expone el `httpClient` subyacente para casos avanzados:

```ts
// Agregar logging
auth.httpClient.addRequestInterceptor(async (ctx) => {
  console.log(`→ ${ctx.method} ${ctx.url}`);
  return ctx;
});

// Ver info del cliente (para debugging)
console.log(auth.httpClient.debugInfo);
// { baseURL: "https://api.boolean.com.ar/auth", timeout: 15000 }
```

---

## Arquitectura

```
@boolean/http           ← Capa HTTP base (fetch, headers, errors, interceptors)
       ↑
@boolean/api-auth       ← Este paquete
├── AuthClient
│   ├── sessions        → SessionsResource  (login, register, logout, refresh)
│   ├── me              → MeResource        (perfil, changePassword)
│   └── passwordRecovery → PasswordRecoveryResource (forgot, reset)
```
