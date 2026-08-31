import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InactivitySessionGuard } from "./inactivity-session-guard";
import type { SessionsResource } from "../resources/sessions";

describe("InactivitySessionGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeSessionsMock(logoutImpl?: () => Promise<unknown>) {
    return {
      logout: vi.fn(logoutImpl ?? (() => Promise.resolve({ data: null, errors: [], meta: {} }))),
    } as unknown as SessionsResource;
  }

  it("empieza en fase 'stopped'", () => {
    const guard = new InactivitySessionGuard(makeSessionsMock());
    expect(guard.phase).toBe("stopped");
  });

  it("start() arranca el watcher subyacente y refleja su fase", () => {
    const guard = new InactivitySessionGuard(makeSessionsMock());
    guard.start({
      warnAfterMs: 1000,
      graceMs: 500,
      onWarning: vi.fn(),
      onSessionExpired: vi.fn(),
      target: undefined,
    });
    expect(guard.phase).toBe("idle-tracking");
  });

  it("dispara onWarning al vencer warnAfterMs", () => {
    const onWarning = vi.fn();
    const guard = new InactivitySessionGuard(makeSessionsMock());
    guard.start({
      warnAfterMs: 1000,
      graceMs: 500,
      onWarning,
      onSessionExpired: vi.fn(),
      target: undefined,
    });

    vi.advanceTimersByTime(1000);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(guard.phase).toBe("warning");
  });

  it("al vencer graceMs sin confirmación, llama a sessions.logout() y luego onSessionExpired", async () => {
    const sessions = makeSessionsMock();
    const onSessionExpired = vi.fn();
    const guard = new InactivitySessionGuard(sessions);
    guard.start({
      warnAfterMs: 1000,
      graceMs: 500,
      onWarning: vi.fn(),
      onSessionExpired,
      target: undefined,
    });

    vi.advanceTimersByTime(1500);
    // el logout es async (promesa real) -- dejamos correr los microtasks
    await vi.waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));

    expect(sessions.logout).toHaveBeenCalledTimes(1);
    expect(sessions.logout).toHaveBeenCalledWith();
  });

  it("onSessionExpired se llama igual si sessions.logout() rechaza (ej: sin conexión)", async () => {
    const sessions = makeSessionsMock(() => Promise.reject(new Error("network down")));
    const onSessionExpired = vi.fn();
    const guard = new InactivitySessionGuard(sessions);
    guard.start({
      warnAfterMs: 1000,
      graceMs: 500,
      onWarning: vi.fn(),
      onSessionExpired,
      target: undefined,
    });

    vi.advanceTimersByTime(1500);
    await vi.waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
    expect(sessions.logout).toHaveBeenCalledTimes(1);
  });

  it("confirmActive() durante 'warning' evita el logout", async () => {
    const sessions = makeSessionsMock();
    const onSessionExpired = vi.fn();
    const guard = new InactivitySessionGuard(sessions);
    guard.start({
      warnAfterMs: 1000,
      graceMs: 500,
      onWarning: vi.fn(),
      onSessionExpired,
      target: undefined,
    });

    vi.advanceTimersByTime(1000);
    expect(guard.phase).toBe("warning");

    guard.confirmActive();
    expect(guard.phase).toBe("idle-tracking");

    vi.advanceTimersByTime(500);
    expect(sessions.logout).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("stop() detiene el watcher sin llamar logout", () => {
    const sessions = makeSessionsMock();
    const guard = new InactivitySessionGuard(sessions);
    guard.start({
      warnAfterMs: 1000,
      graceMs: 500,
      onWarning: vi.fn(),
      onSessionExpired: vi.fn(),
      target: undefined,
    });

    vi.advanceTimersByTime(500);
    guard.stop();
    expect(guard.phase).toBe("stopped");

    vi.advanceTimersByTime(10_000);
    expect(sessions.logout).not.toHaveBeenCalled();
  });

  it("start() llamado de nuevo reemplaza cualquier watcher previo (no quedan timers duplicados)", () => {
    const sessions = makeSessionsMock();
    const onWarningFirst = vi.fn();
    const onWarningSecond = vi.fn();
    const guard = new InactivitySessionGuard(sessions);

    guard.start({
      warnAfterMs: 1000,
      graceMs: 500,
      onWarning: onWarningFirst,
      onSessionExpired: vi.fn(),
      target: undefined,
    });

    vi.advanceTimersByTime(500);

    guard.start({
      warnAfterMs: 1000,
      graceMs: 500,
      onWarning: onWarningSecond,
      onSessionExpired: vi.fn(),
      target: undefined,
    });

    vi.advanceTimersByTime(1000);
    expect(onWarningFirst).not.toHaveBeenCalled();
    expect(onWarningSecond).toHaveBeenCalledTimes(1);
  });

  it("confirmActive() sin watcher activo no lanza error", () => {
    const guard = new InactivitySessionGuard(makeSessionsMock());
    expect(() => guard.confirmActive()).not.toThrow();
  });

  it("stop() sin watcher activo no lanza error", () => {
    const guard = new InactivitySessionGuard(makeSessionsMock());
    expect(() => guard.stop()).not.toThrow();
  });

  describe("generación de ciclo (feedback Cacho #6490)", () => {
    // El logout es async: si se llama stop() o start() de nuevo mientras
    // ese logout del ciclo anterior sigue "en vuelo", su notificación
    // tardía no debe tocar al consumidor -- podría limpiar/redirigir una
    // sesión nueva que nada tiene que ver con la que expiró.

    function makeDeferredSessionsMock() {
      let resolveLogout: () => void = () => undefined;
      const logout = vi.fn(
        () =>
          new Promise<{ data: null; errors: never[]; meta: object }>((resolve) => {
            resolveLogout = () => resolve({ data: null, errors: [], meta: {} });
          })
      );
      const sessions = { logout } as unknown as SessionsResource;
      return { sessions, resolveLogout: () => resolveLogout() };
    }

    it("stop() durante un logout pendiente evita que onSessionExpired se dispare después", async () => {
      const { sessions, resolveLogout } = makeDeferredSessionsMock();
      const onSessionExpired = vi.fn();
      const guard = new InactivitySessionGuard(sessions);

      guard.start({
        warnAfterMs: 1000,
        graceMs: 500,
        onWarning: vi.fn(),
        onSessionExpired,
        target: undefined,
      });

      vi.advanceTimersByTime(1500); // dispara onTimeout -> logout() en vuelo, sin resolver
      guard.stop(); // se detiene ANTES de que el logout resuelva

      resolveLogout(); // recién ahora resuelve la promesa del ciclo viejo
      await vi.waitFor(() => expect(sessions.logout).toHaveBeenCalledTimes(1));
      // dar una vuelta de microtasks para que el .finally() corra
      await Promise.resolve();
      await Promise.resolve();

      expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it("start() nuevo durante un logout pendiente del ciclo anterior no dispara el onSessionExpired viejo sobre la sesión nueva", async () => {
      const { sessions, resolveLogout } = makeDeferredSessionsMock();
      const onSessionExpiredOld = vi.fn();
      const onSessionExpiredNew = vi.fn();
      const guard = new InactivitySessionGuard(sessions);

      guard.start({
        warnAfterMs: 1000,
        graceMs: 500,
        onWarning: vi.fn(),
        onSessionExpired: onSessionExpiredOld,
        target: undefined,
      });

      vi.advanceTimersByTime(1500); // logout en vuelo del ciclo viejo

      // se reconfigura el guard (ej: nuevo login) ANTES de que resuelva
      guard.start({
        warnAfterMs: 1000,
        graceMs: 500,
        onWarning: vi.fn(),
        onSessionExpired: onSessionExpiredNew,
        target: undefined,
      });

      resolveLogout();
      await vi.waitFor(() => expect(sessions.logout).toHaveBeenCalledTimes(1));
      await Promise.resolve();
      await Promise.resolve();

      expect(onSessionExpiredOld).not.toHaveBeenCalled();
      expect(onSessionExpiredNew).not.toHaveBeenCalled(); // el ciclo nuevo ni siquiera venció todavía
    });
  });
});
