let _pull = null;

export function setPullHandle(fn) {
  _pull = fn;
}

export function getPullHandle() {
  return _pull;
}
