// Recursively hide / show an Object3D and every descendant. Setting
// `visible = false` on the root is sufficient for rendering, but we also flip
// every child as a defensive measure in case some other code reads `.visible`
// per-mesh. Used whenever a real annotation object is swapped for a transient
// ghost (move gizmo, extrude preview).

export function deepHide(obj) {
  if (!obj) return;
  obj.visible = false;
  obj.traverse?.((child) => {
    child.visible = false;
  });
}

export function deepShow(obj) {
  if (!obj) return;
  obj.visible = true;
  obj.traverse?.((child) => {
    child.visible = true;
  });
}
