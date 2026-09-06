import type { Instance } from 'ink';

/**
 * Shared handle to the live Ink instance, set by bin.tsx right after
 * render() returns. app.tsx's resize handler needs it to reset Ink's
 * internal log-update bookkeeping (previousLineCount/previousOutput) before
 * writing a fresh frame — see the comment on CLEAR_SCREEN's usage in
 * app.tsx for why this has to run from there, not from bin.tsx.
 */
let instance: Instance | null = null;

export function setInkInstance(i: Instance): void {
  instance = i;
}

export function resetInkBookkeeping(): void {
  instance?.clear();
}
