/**
 * CAJA-6490 — Conecta InactivityWatcher (mecanismo puro de timers/eventos)
 * con el cierre real de la sesión de sistema, vía SessionsResource.
 *
 * Esto es lo que se expone como `auth.inactivity` en AuthClient. El
 * mecanismo de detección en sí (InactivityWatcher) es exportado aparte y
 * puede usarse standalone si algún consumidor necesita el mismo patrón
 * de timers para otra cosa (ej: el cierre de sesión de caja de #6487).
 */

import { InactivityWatcher, type InactivityPhase } from "./inactivity-watcher";
import type { SessionsResource } from "../resources/sessions";

export interface InactivitySessionGuardConfig {
  /** Milisegundos de inactividad antes de mostrar el aviso. */
  warnAfterMs: number;

  /** Milisegundos de gracia después del aviso antes de cerrar la sesión. */
  graceMs: number;

  /** Se llama una vez, al cumplirse warnAfterMs sin actividad. */
  onWarning: () => void;

  /**
   * Se llama una sola vez, DESPUÉS de que se intentó cerrar la sesión de
   * sistema (auth.sessions.logout()) por falta de respuesta al aviso.
   * Se llama igual aunque el logout en sí falle (ej: sin conexión) -- la
   * intención de cerrar sesión no puede quedar bloqueada por eso; el
   * consumidor es responsable de limpiar su estado local (tokens,
   * redirigir al login, cerrar su propia sesión de caja, etc.) en esta
   * callback.
   */
  onSessionExpired: () => void;

  activityEvents?: readonly string[] | undefined;
  target?: EventTarget | undefined;
}

export class InactivitySessionGuard {
  private readonly sessions: SessionsResource;
  private watcher: InactivityWatcher | undefined;

  constructor(sessions: SessionsResource) {
    this.sessions = sessions;
  }

  get phase(): InactivityPhase {
    return this.watcher?.phase ?? "stopped";
  }

  /** Arranca (o reconfigura y reinicia) el watcher de inactividad. */
  start(config: InactivitySessionGuardConfig): void {
    this.watcher?.stop();

    this.watcher = new InactivityWatcher({
      warnAfterMs: config.warnAfterMs,
      graceMs: config.graceMs,
      onWarning: config.onWarning,
      onTimeout: () => {
        // No se espera este logout: si la red está caída justo en este
        // momento, igual queremos avisarle al consumidor que la sesión
        // venció por inactividad -- no dejamos que un logout fallido
        // bloquee esa notificación.
        void this.sessions.logout().catch(() => undefined).finally(() => {
          config.onSessionExpired();
        });
      },
      ...(config.activityEvents !== undefined && { activityEvents: config.activityEvents }),
      ...(config.target !== undefined && { target: config.target }),
    });

    this.watcher.start();
  }

  /** Detiene el watcher (ej: al desmontar la app, o justo después de un logout manual). */
  stop(): void {
    this.watcher?.stop();
  }

  /**
   * El consumidor llama esto desde su aviso interactivo cuando el usuario
   * confirma que sigue ahí. Sin efecto si no hay un watcher corriendo o si
   * no está en fase de aviso.
   */
  confirmActive(): void {
    this.watcher?.confirmActive();
  }
}
