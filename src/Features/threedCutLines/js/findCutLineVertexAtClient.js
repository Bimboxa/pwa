import { Vector3 } from "three";

import getSingleSelectedAnnotationId from "Features/threedDimensions/utils/getSingleSelectedAnnotationId";

import { CUT_LINE_VERTEX_PICK_PX } from "../constants/cutLineStyle";
import { getCutLineEntry } from "../services/cutLineObjectsStore";

// The published entry (cutLineObjectsStore) of the cut line selected ALONE,
// else null.
export function getSelectedCutLineEntry(selectedItems) {
  const selectedId = getSingleSelectedAnnotationId(selectedItems);
  if (!selectedId) return null;
  const entry = getCutLineEntry(selectedId);
  if (!entry?.vertices?.length) return null;
  if (entry.group?.userData?.annotationType !== "CUT_LINE") return null;
  return entry;
}

// The vertex of the selected cut line under the cursor (CSS px, screen
// distance — the markers never raycast). Returns { entry, vertex } or null.
export default function findCutLineVertexAtClient({
  selectedItems,
  dom,
  camera,
  clientX,
  clientY,
}) {
  const entry = getSelectedCutLineEntry(selectedItems);
  if (!entry) return null;
  const rect = dom.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const tmp = new Vector3();
  let best = null;
  let bestSq = CUT_LINE_VERTEX_PICK_PX * CUT_LINE_VERTEX_PICK_PX;
  for (const v of entry.vertices) {
    // The part beyond a « Stop » is not drawn: not grabbable either.
    if (v.hidden) continue;
    tmp.copy(v.world).project(camera);
    if (tmp.z < -1 || tmp.z > 1) continue;
    const sx = rect.left + ((tmp.x + 1) / 2) * rect.width;
    const sy = rect.top + ((1 - tmp.y) / 2) * rect.height;
    const d2 = (sx - clientX) ** 2 + (sy - clientY) ** 2;
    if (d2 < bestSq) {
      bestSq = d2;
      best = v;
    }
  }
  return best ? { entry, vertex: best } : null;
}
