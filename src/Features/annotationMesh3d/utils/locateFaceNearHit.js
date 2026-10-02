import pointInPolygon2d from "../../threedMesh/utils/pointInPolygon2d.js";
import { projectPointTo2d } from "../../threedMesh/utils/planeProjection.js";
import {
  dot,
  length,
  normalize,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";

import { getFace2d } from "./mesh3dFace2d.js";
import { getFaceNormal } from "./mesh3dTopology.js";

// Index of the mesh face a 3D hit point belongs to, tolerating a hit taken
// on a slightly different geometry than the mesh: the displayed host may
// still carry the anti-aliasing shrink (faces 10 mm inward, tops 5 mm
// lower) or the 1 mm z-fight lift, while the mesh is the un-shrunk
// conversion. locatePathOnMesh3d (2 mm) misses those hits.
//
// A face is a candidate when its plane is within maxDistM of the point, its
// normal is parallel to `normal` within 2° (either sign — hit normals are
// often flipped toward the ray; skipped when `normal` is null) and its
// projected polygon (minus holes) contains the projected point, with
// maxDistM of slack around the boundary. With `rayDir` (the view ray, from
// the camera through the hit), faces turned toward the camera (outward
// normal against the ray) come first: on a host under 10 mm tall, the
// shrunk top lies nearer the bottom plane than the real top. Then the
// nearest plane wins; then a strictly inside point beats a slack one.
//
// mesh: LOCAL mesh {vertices: [{x, y, z}], faces: [{loop, holes}]} (see
// getEditableMesh3d), point / normal in the same frame. Returns the face
// index or -1.
//
// Pure (no three.js): node-testable.

const COS_PARALLEL = Math.cos((2 * Math.PI) / 180);

function distToLoop(p, loop) {
  let best = Infinity;
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const lenSq = ex * ex + ey * ey;
    let t = lenSq > 0 ? ((p.x - a.x) * ex + (p.y - a.y) * ey) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p.x - (a.x + t * ex), p.y - (a.y + t * ey));
    if (d < best) best = d;
  }
  return best;
}

export default function locateFaceNearHit(
  mesh,
  point,
  normal = null,
  maxDistM = 0.02,
  { rayDir = null } = {}
) {
  if (!mesh?.faces?.length || !mesh.vertices?.length || !point) return -1;
  const { vertices, faces } = mesh;
  const hitNormal = normal ? normalize(normal) : null;
  const useNormal = hitNormal && length(hitNormal) > 0;
  const ray = rayDir ? normalize(rayDir) : null;
  const useRay = ray && length(ray) > 0;

  let best = -1;
  let bestFront = false;
  let bestPlaneDist = Infinity;
  let bestInside = false;
  let bestBoundaryDist = Infinity;
  faces.forEach((face, faceIndex) => {
    if (!(face?.loop?.length >= 3)) return;
    const faceNormal = getFaceNormal(vertices, face);
    if (!(length(faceNormal) > 0)) return;
    if (useNormal && Math.abs(dot(faceNormal, hitNormal)) < COS_PARALLEL) {
      return;
    }
    const planeDist = Math.abs(
      dot(sub(point, vertices[face.loop[0]]), faceNormal)
    );
    if (planeDist > maxDistM) return;

    const face2d = getFace2d(vertices, face);
    const p = projectPointTo2d(point, face2d.basis);
    const [contour, ...holes] = face2d.loops;
    const inside =
      pointInPolygon2d(p, contour) &&
      !holes.some((hole) => pointInPolygon2d(p, hole));
    const boundaryDist = Math.min(
      ...face2d.loops.map((loop) => distToLoop(p, loop))
    );
    if (!inside && boundaryDist > maxDistM) return;

    const front = useRay ? dot(faceNormal, ray) < 0 : true;
    const better =
      best < 0 ||
      (front && !bestFront) ||
      (front === bestFront &&
        (planeDist < bestPlaneDist - 1e-9 ||
          (Math.abs(planeDist - bestPlaneDist) <= 1e-9 &&
            ((inside && !bestInside) ||
              (inside === bestInside && boundaryDist < bestBoundaryDist)))));
    if (better) {
      best = faceIndex;
      bestFront = front;
      bestPlaneDist = planeDist;
      bestInside = inside;
      bestBoundaryDist = boundaryDist;
    }
  });
  return best;
}
