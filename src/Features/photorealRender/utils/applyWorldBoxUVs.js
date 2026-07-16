import { BufferAttribute, Vector3 } from "three";

const _pA = new Vector3();
const _pB = new Vector3();
const _pC = new Vector3();
const _ab = new Vector3();
const _cb = new Vector3();
const _normal = new Vector3();
const _corners = [_pA, _pB, _pC];

// Writes a per-face box-projected `uv` attribute in geometry-local METERS
// (annotation geometry lives in the basemap-local meter frame — the parent
// group applies only rotation + translation). Each triangle is projected on
// the plane orthogonal to its dominant normal axis, so walls, floors and
// slopes all get undistorted world-scale UVs. Texture tiling then comes from
// texture.repeat = 1 / textureScaleM (see textureCache).
//
// Chosen over a triplanar shader: real `uv` attributes survive the CSG
// subtraction re-application, the USDZ/OBJ exports, and need no
// onBeforeCompile (which would fight the highlight material swaps).
//
// Converts indexed geometry to non-indexed (per-face UVs require unshared
// vertices). Overwrites any pre-existing UVs (ExtrudeGeometry's shape-space
// UVs are not world-scaled and are degenerate on side faces).
export default function applyWorldBoxUVs(mesh) {
  let geometry = mesh?.geometry;
  const position = geometry?.getAttribute?.("position");
  if (!position) return;
  // Idempotence: the flag lives on the geometry, so a CSG geometry swap
  // (which strips uv) naturally re-qualifies for a fresh pass.
  if (geometry.userData?.hasWorldBoxUVs) return;

  if (geometry.index) {
    const nonIndexed = geometry.toNonIndexed();
    nonIndexed.userData = { ...geometry.userData };
    geometry.dispose();
    geometry = nonIndexed;
    mesh.geometry = geometry;
  }

  const pos = geometry.getAttribute("position");
  const uvArray = new Float32Array(pos.count * 2);

  for (let i = 0; i + 2 < pos.count; i += 3) {
    _pA.fromBufferAttribute(pos, i);
    _pB.fromBufferAttribute(pos, i + 1);
    _pC.fromBufferAttribute(pos, i + 2);
    _cb.subVectors(_pC, _pB);
    _ab.subVectors(_pA, _pB);
    _normal.crossVectors(_cb, _ab);
    const ax = Math.abs(_normal.x);
    const ay = Math.abs(_normal.y);
    const az = Math.abs(_normal.z);

    for (let j = 0; j < 3; j++) {
      const p = _corners[j];
      let u;
      let v;
      if (ax >= ay && ax >= az) {
        u = p.y;
        v = p.z;
      } else if (ay >= ax && ay >= az) {
        u = p.x;
        v = p.z;
      } else {
        u = p.x;
        v = p.y;
      }
      uvArray[(i + j) * 2] = u;
      uvArray[(i + j) * 2 + 1] = v;
    }
  }

  geometry.setAttribute("uv", new BufferAttribute(uvArray, 2));
  geometry.userData.hasWorldBoxUVs = true;
}
