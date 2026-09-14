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

### `auth.verifyCredentials`

Verifica usuario + clave de un admin del tenant **sin crear sesión**. El tenant va en `X-Company-Id`, nunca en el body.

| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| `verify(payload)` | `POST /service/verify-credentials/` | ✅ (M2M) | Respuesta cruda `{ valid, user_id, is_admin }` |
| `requestAdminAuthorization(payload)` | igual | ✅ (M2M) | Mapea a `{ authorized, userId, isAdmin }` |

```ts
const result = await auth.verifyCredentials.requestAdminAuthorization({
  username,
  password,
  action: "emit_nc",
  companyId: tenantId,
  actorUserId: String(currentUserId),
});
```

### Modal React (`@boolean-systems-packages/api-auth/react`)

El usuario logueado sigue en su sesión. Un admin pone usuario y clave en el
mismo terminal; se desbloquea **esa** acción. No se abre una sesión para el admin.

El browser **no llama a Auth**. El modal junta las credenciales y el micro las
manda a **su** backend. Ese backend llama a `POST /v3/service/verify-credentials/`
con identidad M2M (`AUTH_OAUTH_*` o `X-Service-Key`).

#### 1. Candado en el backend del micro

- Preview / GET libre.
- En el POST que ejecuta la acción: si el flag está on y el JWT de la sesión
  **no** es admin, exigir `admin_username` + `admin_password`.
- Si faltan: **400** `ADMIN_AUTH_REQUIRED` (no 403: varios axios tratan 403 como refresh).
- Si no valen: **400** `ADMIN_AUTH_INVALID`.
- Si el usuario de la sesión ya es admin del tenant, no pedir nada.

#### 2. Montar el modal

```tsx
import { AdminAuthPrompt } from "@boolean-systems-packages/api-auth/react";
import type { RequestAdminAuthorizationInput } from "@boolean-systems-packages/api-auth/react";

const [open, setOpen] = useState(false);

async function handleEmit() {
  if (requireAdminAuth && !sessionUserIsAdmin) {
    setOpen(true);
    return;
  }
  await confirmAction();
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
      return { authorized: false }; // el modal muestra el error y no cierra
    }
    throw error;
  }
}

<AdminAuthPrompt
  open={open}
  action="emit_nc"
  authorize={authorize}
  onAuthorized={() => {
    setOpen(false);
    // la acción ya se ejecutó adentro de authorize
  }}
  onCancel={() => setOpen(false)}
/>
```

Ejemplo completo: [`05-admin-auth-prompt.tsx`](./examples/05-admin-auth-prompt.tsx).

#### Props

| Prop | Obligatorio | Descripción |
|---|---|---|
| `open` | sí | Si es `false`, no renderiza nada y limpia el form. |
| `action` | sí | Slug de la acción (`emit_nc`, etc.). Viaja en el body hacia Auth. |
| `authorize` | recomendado | Recibe `{ username, password, action }` y debe devolver `{ authorized }`. |
| `onAuthorized` | sí | Se llama solo si `authorize` resolvió `authorized: true`. |
| `onCancel` | sí | Cerrar sin autorizar. |
| `labels` | no | Sobrescribe textos (título, campos, error). |
| `client` + `companyId` | no | Alternativa: el modal llama a Auth vía `createAuthClient`. Solo si el front tiene M2M; en micros Boolean usar `authorize`. |
| `actorUserId` | no | Auditoría (`X-Actor-User-Id`) cuando se usa `client`. |

#### Qué no hacer

- No pegarle a Auth desde el browser con el JWT del usuario.
- No tratar 403 del candado como “hay que pedir admin”: usar 400 + código.
- No mostrar el modal si el logueado ya es admin.

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
| [`05-admin-auth-prompt.tsx`](./examples/05-admin-auth-prompt.tsx) | Modal de autorización de admin (`authorize` → backend del micro) |

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
│   ├── sessions           → SessionsResource  (login, register, logout, refresh)
│   ├── me                 → MeResource        (perfil, changePassword)
│   ├── passwordRecovery   → PasswordRecoveryResource (forgot, reset)
│   └── verifyCredentials  → VerifyCredentialsResource (admin sin sesión)
└── ./react
    └── AdminAuthPrompt
```
