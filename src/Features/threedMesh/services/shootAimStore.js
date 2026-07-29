// Tiny external store connecting the imperative walk-mode spray code to the
// ShootLanceOverlayThreed DOM overlay: `firingUntil` drives the weapon
// recoil/shake animation (far ahead while Space is held, reset on release);
// `jetMode` + `spreadDeg` feed the nozzle HUD readout (B/P/M tuning) and
// `targetDistM` the crosshair-to-target distance (null = aiming the void).

let _state = {
  firingUntil: 0,
  jetMode: null,
  spreadDeg: null,
  targetDistM: null,
};
const _listeners = new Set();

export function emitShoot(partial) {
  _state = { ..._state, ...partial };
  _listeners.forEach((listener) => listener());
}

export function getShootState() {
  return _state;
}

export function subscribeShoot(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
