/** One whole-object turn while a homepage figure steps out of its drawing. */

export const POPOUT_RISE_SECONDS = 0.55;
export const POPOUT_SPIN_SECONDS = 1.5;

const FULL_TURN = Math.PI * 2;

function easeInOut(amount: number): number {
  return amount < 0.5 ? 2 * amount * amount : 1 - (-2 * amount + 2) ** 2 / 2;
}

/** Extra yaw after the figure has stepped out. Zero while it is still rising. */
export function popoutSpinYaw(elapsedSeconds: number): number {
  if (elapsedSeconds <= POPOUT_RISE_SECONDS) return 0;
  const amount = Math.min(1, (elapsedSeconds - POPOUT_RISE_SECONDS) / POPOUT_SPIN_SECONDS);
  return easeInOut(amount) * FULL_TURN;
}

export function popoutSpinSettled(elapsedSeconds: number): boolean {
  return elapsedSeconds >= POPOUT_RISE_SECONDS + POPOUT_SPIN_SECONDS;
}
