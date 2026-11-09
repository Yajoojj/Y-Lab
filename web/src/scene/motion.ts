/** Preferência do sistema por menos movimento (lida uma vez; muda raramente). */
export const REDUCED_MOTION: boolean = (() => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
})();

/** Fator de movimento: 1 normal, ~0.25 com movimento reduzido. */
export const MOTION = REDUCED_MOTION ? 0.25 : 1;
