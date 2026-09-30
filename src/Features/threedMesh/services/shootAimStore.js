// Tiny external store connecting the imperative walk-mode code to the
// ShootLanceOverlayThreed DOM overlay (HUD + weapon image). Walk-local,
// ephemeral state — reseeded on every walk entry, so it lives here rather
// than in Redux (written at 10 Hz by the aim poll, single consumer):
// - `tool`: the active walk tool (WALK_TOOLS) — O switches;
// - `firingUntil` drives the weapon recoil/shake animation (far ahead while
//   Space is held with the lance, reset on release);
// - `jetMode` + `spreadDeg` feed the nozzle HUD readout (B / + / - tuning);
// - `targetDistM`: crosshair-to-surface distance (null = aiming the void);
// - `measureHasStart` / `measureLiveM` / `measureCount`: measure tool state
//   (pending first point, live length from it to the crosshair, number of
//   committed measures).

export const WALK_TOOLS = ["LANCE", "MEASURE"];

const INITIAL_STATE = {
  tool: "LANCE",
  firingUntil: 0,
  jetMode: null,
  spreadDeg: null,
  targetDistM: null,
  measureHasStart: false,
  measureLiveM: null,
  measureCount: 0,
};

let _state = { ...INITIAL_STATE };
const _listeners = new Set();

export function emitShoot(partial) {
  _state = { ..._state, ...partial };
  _listeners.forEach((listener) => listener());
}

export function resetShoot() {
  emitShoot({ ...INITIAL_STATE });
}

export function getShootState() {
  return _state;
}

export function subscribeShoot(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
