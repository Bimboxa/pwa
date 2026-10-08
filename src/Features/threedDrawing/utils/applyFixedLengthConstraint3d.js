import { Vector3 } from "three";

// 3D counterpart of mapEditorGeneric/utils/applyFixedLengthConstraint: keeps
// the direction `last → candidate` and rescales the distance to `lengthM`
// (the scene works in metres). Degenerate direction (cursor on the last
// vertex) falls back to +X, like the 2D helper.
//
// Returns a new Vector3, or `candidate` untouched when the length is not
// usable.
export default function applyFixedLengthConstraint3d({
  last,
  candidate,
  lengthM,
}) {
  if (!last || !candidate) return candidate;
  const length = Number(lengthM);
  if (!Number.isFinite(length) || length <= 0) return candidate;

  const from = new Vector3(last.x, last.y, last.z);
  const dir = new Vector3(candidate.x, candidate.y, candidate.z).sub(from);
  const dist = dir.length();
  if (!Number.isFinite(dist) || dist <= 1e-6) {
    return from.add(new Vector3(length, 0, 0));
  }
  return from.add(dir.multiplyScalar(length / dist));
}
