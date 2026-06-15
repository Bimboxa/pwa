import getAnnotationVertices from "Features/annotations/utils/getAnnotationVertices";

// Centerline junction repair (thin OPEN polylines, e.g. wall axes / U shapes).
//
// For every free endpoint of an open polyline that lies INSIDE the selection
// rectangle, project it onto the nearest segment of another concerned
// annotation and move it there — i.e. extend the branch until it meets its
// target line. Each open endpoint is handled independently, so both branches of
// a U connect in one pass.
//
// Returns in-place updates: [{ ann, pointsPx:[{x,y}], closed:false }]. Empty
// when nothing applies (e.g. all concerned annotations are closed outlines).

function isClosed(ann, verts) {
  if (ann.type === "POLYGON" || ann.closeLine === true) return true;
  if (verts.length >= 4) {
    const a = verts[0];
    const b = verts[verts.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) return true;
  }
  return false;
}

function projectClampedOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-9) {
    return { proj: { x: a.x, y: a.y }, dist: Math.hypot(p.x - a.x, p.y - a.y) };
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return { proj, dist: Math.hypot(p.x - proj.x, p.y - proj.y) };
}

function inRect(p, rect) {
  return (
    p.x >= rect.x &&
    p.x <= rect.x + rect.width &&
    p.y >= rect.y &&
    p.y <= rect.y + rect.height
  );
}

export default function buildCenterlineRepair({ annotations, rect, maxDist }) {
  if (!rect || !Array.isArray(annotations) || annotations.length < 2) return [];

  const entries = annotations.map((ann) => ({
    ann,
    verts: getAnnotationVertices(ann).map((p) => ({ x: p.x, y: p.y })),
  }));

  const cap =
    maxDist != null ? maxDist : Math.hypot(rect.width, rect.height) || Infinity;

  const updates = [];
  for (const { ann, verts } of entries) {
    if (isClosed(ann, verts)) continue; // no free endpoints
    const n = verts.length;
    if (n < 2) continue;

    const newVerts = verts.map((p) => ({ x: p.x, y: p.y }));
    let moved = false;

    for (const ei of [0, n - 1]) {
      const ep = verts[ei];
      if (!inRect(ep, rect)) continue;

      let best = null;
      for (const other of entries) {
        if (other.ann.id === ann.id) continue;
        const ov = other.verts;
        if (ov.length < 2) continue;
        const segCount = isClosed(other.ann, ov) ? ov.length : ov.length - 1;
        for (let k = 0; k < segCount; k++) {
          const a = ov[k];
          const b = ov[(k + 1) % ov.length];
          const pr = projectClampedOnSegment(ep, a, b);
          if (!best || pr.dist < best.dist) best = pr;
        }
      }

      if (best && best.dist <= cap) {
        newVerts[ei] = { x: best.proj.x, y: best.proj.y };
        moved = true;
      }
    }

    if (moved) {
      updates.push({ ann, pointsPx: newVerts, closed: false });
    }
  }

  return updates;
}
