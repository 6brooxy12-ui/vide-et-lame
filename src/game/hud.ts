type Phase = "prêt" | "armement" | "frappe" | "récupération";

type Listener = (phase: Phase, locked: boolean) => void;

let phase: Phase = "prêt";
let locked = false;
const listeners = new Set<Listener>();

export function setHud(next: { phase?: Phase; locked?: boolean }) {
  if (next.phase) phase = next.phase;
  if (next.locked !== undefined) locked = next.locked;
  for (const fn of listeners) fn(phase, locked);
}

export function subscribeHud(fn: Listener) {
  listeners.add(fn);
  fn(phase, locked);
  return () => {
    listeners.delete(fn);
  };
}

export type { Phase };
