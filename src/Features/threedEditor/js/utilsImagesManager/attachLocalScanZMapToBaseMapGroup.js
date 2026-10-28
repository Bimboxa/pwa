import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { darken, lighten } from "@mui/material/styles";

import theme from "Styles/theme";
import {
  getLocalScanHeightRange,
  loadLocalScanHeightMap,
} from "Features/localScans/services/localScanHeightMapService";
import buildLocalScanZMapGeometry from "Features/localScans/utils/buildLocalScanZMapGeometry";

// Colour ramp of the Zmap: light to dark variants of the secondary colour
// (the heat map of the Scan 3D panel), low to high in the slice.
function createHeightColorAt() {
  const secondary = theme.palette.secondary.main;
  const parse = (css) => {
    const match = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
    return match ? match.slice(1, 4).map((v) => Number(v) / 255) : [0, 0, 0];
  };
  const low = parse(lighten(secondary, 0.85));
  const mid = parse(secondary);
  const high = parse(darken(secondary, 0.45));
  return (t) => {
    const [a, b, k] = t < 0.5 ? [low, mid, t * 2] : [mid, high, (t - 0.5) * 2];
    return a.map((value, c) => value + (b[c] - value) * k);
  };
}

// Zmap of a base map projected from a local point cloud: its height map
// (localScanHeightMapService, base map group frame) as a mesh attached to
// the base map group — x = image X, y = image up, z = above the plane, the
// group frame of a horizontal base map — so it follows every move of the
// map. Unlike the point cloud it answers the raycaster: the 3D altimetry
// badge reads its hits, and drawings land on the relief. Tagged `isDecor`
// so the per-object scene passes (shadows, sketch edges, hover swap, vertex
// snap, export) leave it alone.
// options: {sceneManager, onLoaded}. Returns {dispose}.
export default function attachLocalScanZMapToBaseMapGroup(
  group,
  baseMap,
  { sceneManager, onLoaded } = {}
) {
  let disposed = false,
    mesh = null;

  (async () => {
    const heightMap = await loadLocalScanHeightMap(baseMap);
    if (disposed || !heightMap) return;
    const geometryData = buildLocalScanZMapGeometry(heightMap, {
      range: getLocalScanHeightRange(baseMap),
      colorAt: createHeightColorAt(),
    });
    if (geometryData.triangleCount === 0) return;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(geometryData.positions, 3)
    );
    geometry.setAttribute("color", new BufferAttribute(geometryData.colors, 3));
    geometry.setIndex(new BufferAttribute(geometryData.index, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = new MeshBasicMaterial({
      vertexColors: true,
      side: DoubleSide,
      toneMapped: false,
      // above the base map plane in every depth contest
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    mesh = new Mesh(geometry, material);
    mesh.name = "Local scan zmap";
    mesh.userData.kind = "baseMapLocalScanZMap";
    mesh.userData.isDecor = true;
    mesh.userData.baseMapId = baseMap.id;
    if (disposed) {
      geometry.dispose();
      material.dispose();
      return;
    }
    group.add(mesh);
    group.userData.localScanZMap = mesh;
    onLoaded?.();
  })().catch((error) => {
    console.warn("[localScans] zmap not built", error);
  });

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      if (mesh) {
        group.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        if (group.userData.localScanZMap === mesh)
          delete group.userData.localScanZMap;
        mesh = null;
      }
      sceneManager?.renderScene?.();
    },
  };
}
