import { getFaceRegion } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import { buildWorldSoup } from "Features/threedMesh/utils/buildMeshDataFromRegion";
import {
  collectAnnotationSolidMeshes,
  getAnnotationMergedHost,
} from "Features/threedMesh/utils/getAnnotationFaceRegion";

// Every face REGION of the visible annotations of the scene, whatever their
// type (any solid kept by the annotation objects: extrusions, walls,
// revolutions, 3D meshes, GLB objects…), as world triangle soups — the same
// regions the Maillage hover grows (getFaceRegion with the face selection
// angle: a planar face, or a curved surface followed across its facets).
//
// Shared by « Mailler » (createMeshesFromCutLinesService) and the cut lines
// AI prompt (collectCutLinesPromptRegions). A generator: the caller may
// await between two regions.
//
// Yields { annotationId, soup: { positions, tris } }.
export default function* collectVisibleFaceRegions(sceneManager, { angleDeg }) {
  const annotationsManager = sceneManager?.annotationsManager;
  const roots = Object.values(
    annotationsManager?.annotationsObjectsMap || {}
  ).filter((root) => root?.visible && root.userData?.nodeId);

  for (const root of roots) {
    const annotationId = root.userData.nodeId;
    for (const host of collectHosts(root)) {
      const { geometry, matrixWorld, plane } = host;
      const index = geometry?.index;
      const triCount = index
        ? index.count / 3
        : (geometry?.attributes?.position?.count ?? 0) / 3;
      if (!triCount) continue;

      const assigned = new Uint8Array(triCount);
      for (let t = 0; t < triCount; t++) {
        if (assigned[t]) continue;
        const region = getFaceRegion(geometry, t, { plane, angleDeg });
        if (!region?.tris?.length) {
          assigned[t] = 1;
          continue;
        }
        region.tris.forEach((i) => {
          assigned[i] = 1;
        });
        const soup = buildWorldSoup(geometry, matrixWorld, region.tris);
        if (soup) yield { annotationId, soup };
      }
    }
  }
}

// The geometries to walk for one annotation root: its merged host (every
// solid mesh in the root's frame) when it has several, else each solid mesh
// on its own (plane mode on a CSG-carved mesh) — the same split as the hover.
function collectHosts(root) {
  const merged = getAnnotationMergedHost(root);
  if (merged) {
    root.updateWorldMatrix(true, false);
    return [
      {
        geometry: merged.geometry,
        matrixWorld: root.matrixWorld,
        plane: false,
      },
    ];
  }
  return collectAnnotationSolidMeshes(root).map((mesh) => {
    mesh.updateWorldMatrix(true, false);
    return {
      geometry: mesh.geometry,
      matrixWorld: mesh.matrixWorld,
      plane: !!mesh.userData?.hasSubtraction,
    };
  });
}
