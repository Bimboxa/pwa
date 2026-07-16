// Tiny external store connecting the imperative shoot producers (meshing
// pointer handlers, walk mode) to the ShootLanceOverlayThreed DOM overlay.
// `aim` is px relative to the 3D canvas (null = aim straight ahead);
// `firingUntil` re-arms the recoil animation on each shot.

let _state = { aim: null, firingUntil: 0 };
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
