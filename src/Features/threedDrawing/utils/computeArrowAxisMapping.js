import { Vector3 } from "three";

// Which user axis (X / Y / Z of the gizmo frame, getUserAxesWorldDirections)
// each arrow key locks while drawing in 3D, from the camera orientation:
//   ↑  the axis most vertical on screen,
//   →  among the two others, the one most horizontal on screen,
//   ↓  the remaining one (the depth of the screen).
// Top view → { up: "Y", right: "X", down: "Z" }; a view along user Y →
// { up: "Z", right: "X", down: "Y" }.
//
// userAxes: [{ key, dir: Vector3 (unit) }]. Returns { up, right, down } with
// the axis keys, or null without a camera / three axes.
export default function computeArrowAxisMapping(camera, userAxes) {
  if (!camera?.matrixWorld || userAxes?.length !== 3) return null;
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  right.normalize();
  up.normalize();

  const mostAligned = (axes, screenDir) =>
    axes.reduce((best, axis) => {
      const score = Math.abs(axis.dir.dot(screenDir));
      return !best || score > best.score ? { axis, score } : best;
    }, null).axis;

  const upAxis = mostAligned(userAxes, up);
  const others = userAxes.filter((a) => a !== upAxis);
  const rightAxis = mostAligned(others, right);
  const downAxis = others.find((a) => a !== rightAxis);
  return { up: upAxis.key, right: rightAxis.key, down: downAxis.key };
}

// True when both mappings lock the same axes (null-safe).
export function isSameArrowAxisMapping(a, b) {
  if (!a || !b) return a === b;
  return a.up === b.up && a.right === b.right && a.down === b.down;
}
