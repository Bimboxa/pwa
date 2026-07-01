/**
 * Materialize Typeson cyclic references ("#") in a dexie-export row so that
 * downstream id-remapping AND Dexie's import-time revive both see a plain tree.
 *
 * dexie-export-import (Typeson) dedupes shared object references: when two array
 * slots hold the SAME object at export time (e.g. an annotation whose points[]
 * repeats the same point-ref object), the second slot is written as a keypath
 * string like "#points.11" and flagged in the row's `$types` as "#". A normal
 * import resolves it back to the shared object with no problem.
 *
 * The DUPLICATE path (remapDexieExportIds) rewrites points[] assuming every
 * element is a { id } object; on the "#..." string it produces { id: undefined }
 * while leaving the now-stale `$types[keypath] = "#"` in place. At import,
 * TSON.revive() hits that "#" marker and calls value.slice() on the object
 * → "value.slice is not a function".
 *
 * Resolving refs up-front (deep-clone the referenced value into the keypath,
 * drop the "#" marker) removes the hazard generically — for points[], cuts[],
 * or any future shared-object case. Cloning (vs re-sharing) is fine: the id
 * remap maps both slots to the same remapped id, preserving the original
 * "two refs to the same point" semantics.
 *
 * Mutates `row` in place and returns it.
 */
export default function resolveTypesonCyclicRefs(row) {
  const types = row?.$types;
  if (!types || typeof types !== "object") return row;

  for (const [keypath, type] of Object.entries(types)) {
    if (type !== "#") continue; // only cyclic references

    const ref = getByKeyPath(row, keypath); // e.g. "#points.11"
    if (typeof ref === "string" && ref[0] === "#") {
      const target = getByKeyPath(row, ref.slice(1)); // row.points[11]
      if (target !== undefined) {
        setByKeyPath(row, keypath, deepClone(target));
      }
    }
    delete types[keypath]; // marker no longer valid once resolved
  }

  return row;
}

// Keypaths here are simple dot-joined keys / array indices (e.g. "points.12");
// Typeson's dot/tilde escaping is not needed for annotation/point data.
function getByKeyPath(obj, keypath) {
  return keypath
    .split(".")
    .reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setByKeyPath(obj, keypath, value) {
  const parts = keypath.split(".");
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (o == null) return;
    o = o[parts[i]];
  }
  if (o != null) o[parts[parts.length - 1]] = value;
}

function deepClone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
