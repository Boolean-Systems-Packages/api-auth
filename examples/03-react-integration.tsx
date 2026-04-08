/**
 * Ejemplo 3: Uso en React
 *
 * Cómo integrar @boolean-systems-packages/api-auth en una app React.
 * Patron: instancia global del cliente + hook para consumirlo.
 */

import { createAuthClient } from "@boolean-systems-packages/api-auth";
import type { User, Session } from "@boolean-systems-packages/api-auth";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { UnauthorizedError } from "@boolean-systems-packages/http";

// ─────────────────────────────────────────────
// 1. Instancia global del cliente (un solo lugar)
// ─────────────────────────────────────────────

// La instancia se crea UNA sola vez fuera del render tree.
// getAuthHeader es una función → siempre lee el token más nuevo.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_API_URL,
  getAuthHeader: () => `Bearer ${localStorage.getItem("access_token") ?? ""}`,
});

// ─────────────────────────────────────────────
// 2. Context + Provider
// ─────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Usa el cliente global — ni fetch, ni URLs, ni headers
      const session: Session = await authClient.sessions.login({
        email,
        password,
      });

      // Guardar tokens
      localStorage.setItem("access_token", session.tokens.accessToken);
      localStorage.setItem("refresh_token", session.tokens.refreshToken);

      setUser(session.user);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw new Error("Email o contraseña incorrectos");
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authClient.sessions.logout();
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────
// 3. Hook para consumir el contexto
// ─────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}

// ─────────────────────────────────────────────
// 4. Componente de login de ejemplo
// ─────────────────────────────────────────────

export function LoginForm() {
  const { login, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    try {
      await login(email, password);
      // Redirigir al home o donde corresponda
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
