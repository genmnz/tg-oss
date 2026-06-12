/**
 * The Open Vector Editor's command/action layer occasionally surfaces user
 * feedback through the global `window.toastr` object (e.g. "Undo Successful",
 * "bpLimit exceeded"). That global only exists when the full React UI shell is
 * mounted.
 *
 * In a headless context there is no UI shell, so we install a safe, overridable
 * fallback. Consumers can supply their own `notify` callback when creating an
 * editor to route these messages into their own UI.
 */

export type NotifyLevel = "success" | "info" | "warning" | "error";

export type NotifyFn = (level: NotifyLevel, message: string) => void;

const noopNotify: NotifyFn = () => undefined;

/**
 * Ensures `window.toastr` exists so that the underlying OVE action creators do
 * not throw when they call `window.toastr.success(...)` etc. The provided
 * `notify` callback (or a no-op) receives every message in a normalized shape.
 *
 * This is intentionally idempotent and only patches missing methods so it never
 * clobbers a real toastr instance provided by a host application.
 */
export function installNotifyShim(notify: NotifyFn = noopNotify): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { toastr?: Record<string, unknown> };
  const existing = w.toastr || {};
  const levels: NotifyLevel[] = ["success", "info", "warning", "error"];
  levels.forEach(level => {
    if (typeof existing[level] !== "function") {
      existing[level] = (message: string) => notify(level, message);
    }
  });
  w.toastr = existing;
}
