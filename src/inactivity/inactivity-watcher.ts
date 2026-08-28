/**
 * CAJA-6490 — Detección de inactividad con aviso previo.
 *
 * Mecanismo puro (sin HTTP, sin React, sin UI) que:
 *  1. Cuenta inactividad del usuario (sin eventos de mouse/teclado/touch/scroll).
 *  2. Pasado `warnAfterMs`, dispara `onWarning` — el consumidor muestra su
 *     propio aviso interactivo ("seguís ahí?").
 *  3. Si el usuario confirma (`confirmActive()`) antes de que pase `graceMs`
 *     desde el aviso, se cancela el cierre y el timer arranca de cero.
 *  4. Si no confirma a tiempo, dispara `onTimeout` una sola vez y se detiene.
 *
 * Deliberadamente NO cierra ninguna sesión por sí mismo — eso queda para
 * quien lo consuma (ver InactivitySessionGuard, que sí lo conecta a
 * auth.sessions.logout()). Así este mecanismo se puede reusar tal cual para
 * cualquier otro timeout de inactividad que no sea "cerrar sesión del todo"
 * (ej: la sesión de caja de #6487, que un consumidor como hotel.front
 * dispara aparte en su propio onTimeout).
 */

export type InactivityPhase = "stopped" | "idle-tracking" | "warning" | "expired";

export interface InactivityWatcherConfig {
  /** Milisegundos de inactividad antes de disparar `onWarning`. */
  warnAfterMs: number;

  /**
   * Milisegundos de gracia después del aviso, antes de disparar `onTimeout`,
   * si el usuario no confirma con `confirmActive()`.
   */
  graceMs: number;

  /**
   * Se llama una vez, al cumplirse `warnAfterMs` sin actividad.
   * El consumidor debería mostrar acá su aviso interactivo.
   */
  onWarning: () => void;

  /**
   * Se llama una vez, si pasa `graceMs` desde el aviso sin que se llame a
   * `confirmActive()`. El watcher se detiene después de esto (fase "expired")
   * — hay que llamar `start()` de nuevo para reactivarlo.
   */
  onTimeout: () => void;

  /**
   * Eventos del DOM que cuentan como "actividad" durante el tracking normal
   * (fase "idle-tracking"). Una vez que se muestra el aviso (fase
   * "warning"), estos eventos YA NO resetean el timer solos — hace falta la
   * confirmación explícita vía `confirmActive()`. Esto es a propósito: el
   * criterio de aceptación pide una confirmación interactiva, no que
   * cualquier movimiento de mouse de fondo la reinicie en silencio.
   *
   * Default: mousemove, mousedown, keydown, touchstart, wheel, scroll.
   */
  activityEvents?: readonly string[] | undefined;

  /**
   * Target sobre el que escuchar los eventos de actividad.
   * Default: `window` si existe (entorno browser).
   */
  target?: EventTarget | undefined;
}

const DEFAULT_ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "wheel",
  "scroll",
] as const;

export class InactivityWatcher {
  private readonly config: InactivityWatcherConfig;
  private readonly target: EventTarget | undefined;
  private readonly activityEvents: readonly string[];
  private readonly handleActivity = () => this.onActivity();

  private phaseValue: InactivityPhase = "stopped";
  private warnTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private graceTimeoutId: ReturnType<typeof setTimeout> | undefined;

  constructor(config: InactivityWatcherConfig) {
    if (config.warnAfterMs <= 0) {
      throw new Error("warnAfterMs debe ser mayor que 0");
    }
    if (config.graceMs <= 0) {
      throw new Error("graceMs debe ser mayor que 0");
    }

    this.config = config;
    this.activityEvents = config.activityEvents ?? DEFAULT_ACTIVITY_EVENTS;
    this.target = config.target ?? (typeof window !== "undefined" ? window : undefined);
  }

  get phase(): InactivityPhase {
    return this.phaseValue;
  }

  /** Arranca (o reinicia desde cero) el tracking de inactividad. */
  start(): void {
    this.clearTimers();
    this.attachActivityListeners();
    this.phaseValue = "idle-tracking";
    this.armWarnTimer();
  }

  /** Detiene el watcher por completo: saca listeners y cancela timers. */
  stop(): void {
    this.clearTimers();
    this.detachActivityListeners();
    this.phaseValue = "stopped";
  }

  /**
   * El consumidor llama esto desde su aviso interactivo cuando el usuario
   * confirma que sigue ahí. Solo tiene efecto en fase "warning" — cancela
   * el cierre y vuelve a "idle-tracking" desde cero.
   */
  confirmActive(): void {
    if (this.phaseValue !== "warning") return;

    this.clearTimers();
    this.phaseValue = "idle-tracking";
    this.armWarnTimer();
  }

  private onActivity(): void {
    // Una vez en "warning", la actividad de fondo (mouse pasando por
    // encima, scroll accidental) NO cuenta como confirmación -- ver el
    // comentario de activityEvents. Solo confirmActive() saca de acá.
    if (this.phaseValue !== "idle-tracking") return;

    this.armWarnTimer();
  }

  private armWarnTimer(): void {
    if (this.warnTimeoutId !== undefined) clearTimeout(this.warnTimeoutId);

    this.warnTimeoutId = setTimeout(() => {
      this.phaseValue = "warning";
      this.config.onWarning();
      this.armGraceTimer();
    }, this.config.warnAfterMs);
  }

  private armGraceTimer(): void {
    if (this.graceTimeoutId !== undefined) clearTimeout(this.graceTimeoutId);

    this.graceTimeoutId = setTimeout(() => {
      this.phaseValue = "expired";
      this.detachActivityListeners();
      this.config.onTimeout();
    }, this.config.graceMs);
  }

  private clearTimers(): void {
    if (this.warnTimeoutId !== undefined) {
      clearTimeout(this.warnTimeoutId);
      this.warnTimeoutId = undefined;
    }
    if (this.graceTimeoutId !== undefined) {
      clearTimeout(this.graceTimeoutId);
      this.graceTimeoutId = undefined;
    }
  }

  private attachActivityListeners(): void {
    if (!this.target) return;
    for (const event of this.activityEvents) {
      this.target.addEventListener(event, this.handleActivity, { passive: true });
    }
  }

  private detachActivityListeners(): void {
    if (!this.target) return;
    for (const event of this.activityEvents) {
      this.target.removeEventListener(event, this.handleActivity);
    }
  }
}

/** Factory function, misma convención que `createAuthClient`. */
export function createInactivityWatcher(config: InactivityWatcherConfig): InactivityWatcher {
  return new InactivityWatcher(config);
}
