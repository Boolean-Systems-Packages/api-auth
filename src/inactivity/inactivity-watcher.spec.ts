import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InactivityWatcher, createInactivityWatcher } from "./inactivity-watcher";

describe("InactivityWatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeWatcher(overrides: Partial<{ onWarning: () => void; onTimeout: () => void }> = {}) {
    const onWarning = overrides.onWarning ?? vi.fn();
    const onTimeout = overrides.onTimeout ?? vi.fn();
    const watcher = new InactivityWatcher({
      warnAfterMs: 1000,
      graceMs: 500,
      onWarning,
      onTimeout,
      target: undefined, // sin DOM real en el entorno de test
    });
    return { watcher, onWarning, onTimeout };
  }

  it("arranca en fase 'stopped' antes de start()", () => {
    const { watcher } = makeWatcher();
    expect(watcher.phase).toBe("stopped");
  });

  it("pasa a 'idle-tracking' al llamar start()", () => {
    const { watcher } = makeWatcher();
    watcher.start();
    expect(watcher.phase).toBe("idle-tracking");
  });

  it("dispara onWarning y pasa a fase 'warning' tras warnAfterMs sin actividad", () => {
    const { watcher, onWarning } = makeWatcher();
    watcher.start();

    vi.advanceTimersByTime(999);
    expect(onWarning).not.toHaveBeenCalled();
    expect(watcher.phase).toBe("idle-tracking");

    vi.advanceTimersByTime(1);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(watcher.phase).toBe("warning");
  });

  it("la actividad durante 'idle-tracking' resetea el timer de warning", () => {
    const { watcher, onWarning } = makeWatcher();
    watcher.start();

    vi.advanceTimersByTime(900);
    // acceso al handler privado (bracket notation) para simular actividad sin DOM
    watcher["onActivity"]();
    vi.advanceTimersByTime(900);
    expect(onWarning).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it("la actividad pasiva durante 'warning' NO resetea el timer (a propósito)", () => {
    const { watcher, onWarning, onTimeout } = makeWatcher();
    watcher.start();
    vi.advanceTimersByTime(1000);
    expect(watcher.phase).toBe("warning");

    // simula actividad de fondo (mouse pasando, scroll accidental)
    watcher["onActivity"]();
    expect(watcher.phase).toBe("warning");
    expect(onWarning).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(watcher.phase).toBe("expired");
  });

  it("confirmActive() durante 'warning' cancela el cierre y vuelve a 'idle-tracking'", () => {
    const { watcher, onWarning, onTimeout } = makeWatcher();
    watcher.start();
    vi.advanceTimersByTime(1000);
    expect(watcher.phase).toBe("warning");

    watcher.confirmActive();
    expect(watcher.phase).toBe("idle-tracking");

    // no debería expirar con el tiempo de gracia original
    vi.advanceTimersByTime(500);
    expect(onTimeout).not.toHaveBeenCalled();

    // el ciclo completo vuelve a arrancar desde cero
    vi.advanceTimersByTime(500);
    expect(onWarning).toHaveBeenCalledTimes(2);
  });

  it("confirmActive() no tiene efecto fuera de la fase 'warning'", () => {
    const { watcher } = makeWatcher();
    watcher.start();
    expect(watcher.phase).toBe("idle-tracking");

    watcher.confirmActive();
    expect(watcher.phase).toBe("idle-tracking");
  });

  it("dispara onTimeout una sola vez tras graceMs sin confirmación, y se detiene", () => {
    const { watcher, onTimeout } = makeWatcher();
    watcher.start();

    vi.advanceTimersByTime(1000); // warning
    vi.advanceTimersByTime(499);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(watcher.phase).toBe("expired");

    // no vuelve a dispararse por más que pase el tiempo
    vi.advanceTimersByTime(10_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("stop() cancela los timers pendientes y no dispara callbacks", () => {
    const { watcher, onWarning, onTimeout } = makeWatcher();
    watcher.start();
    vi.advanceTimersByTime(500);

    watcher.stop();
    expect(watcher.phase).toBe("stopped");

    vi.advanceTimersByTime(10_000);
    expect(onWarning).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("start() llamado de nuevo reinicia el ciclo desde cero (ej: después de expired)", () => {
    const { watcher, onWarning } = makeWatcher();
    watcher.start();
    vi.advanceTimersByTime(1500); // warning + timeout -> expired

    watcher.start();
    expect(watcher.phase).toBe("idle-tracking");

    vi.advanceTimersByTime(999);
    expect(onWarning).toHaveBeenCalledTimes(1); // el del primer ciclo únicamente
    vi.advanceTimersByTime(1);
    expect(onWarning).toHaveBeenCalledTimes(2);
  });

  it("valida que warnAfterMs y graceMs sean mayores que 0", () => {
    expect(() => new InactivityWatcher({ warnAfterMs: 0, graceMs: 100, onWarning: vi.fn(), onTimeout: vi.fn() })).toThrow();
    expect(() => new InactivityWatcher({ warnAfterMs: 100, graceMs: 0, onWarning: vi.fn(), onTimeout: vi.fn() })).toThrow();
  });

  it("createInactivityWatcher() es equivalente al constructor (misma convención que createAuthClient)", () => {
    const onWarning = vi.fn();
    const watcher = createInactivityWatcher({
      warnAfterMs: 1000,
      graceMs: 500,
      onWarning,
      onTimeout: vi.fn(),
      target: undefined,
    });
    expect(watcher).toBeInstanceOf(InactivityWatcher);
    watcher.start();
    vi.advanceTimersByTime(1000);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  describe("listeners de actividad sobre un EventTarget real", () => {
    it("un evento de actividad (ej: mousemove) resetea el timer en idle-tracking", () => {
      const target = new EventTarget();
      const onWarning = vi.fn();
      const watcher = new InactivityWatcher({
        warnAfterMs: 1000,
        graceMs: 500,
        onWarning,
        onTimeout: vi.fn(),
        target,
      });
      watcher.start();

      vi.advanceTimersByTime(900);
      target.dispatchEvent(new Event("mousemove"));
      vi.advanceTimersByTime(900);
      expect(onWarning).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it("stop() desengancha los listeners: actividad posterior no hace nada", () => {
      const target = new EventTarget();
      const onWarning = vi.fn();
      const watcher = new InactivityWatcher({
        warnAfterMs: 1000,
        graceMs: 500,
        onWarning,
        onTimeout: vi.fn(),
        target,
      });
      watcher.start();
      watcher.stop();

      target.dispatchEvent(new Event("mousemove"));
      vi.advanceTimersByTime(10_000);
      expect(onWarning).not.toHaveBeenCalled();
    });

    it("respeta activityEvents personalizado en vez del default", () => {
      const target = new EventTarget();
      const onWarning = vi.fn();
      const watcher = new InactivityWatcher({
        warnAfterMs: 1000,
        graceMs: 500,
        onWarning,
        onTimeout: vi.fn(),
        target,
        activityEvents: ["custom-activity"],
      });
      watcher.start();

      vi.advanceTimersByTime(900);
      // un evento default (mousemove) NO cuenta si no está en la lista custom
      target.dispatchEvent(new Event("mousemove"));
      vi.advanceTimersByTime(100);
      expect(onWarning).toHaveBeenCalledTimes(1);
    });
  });
});
