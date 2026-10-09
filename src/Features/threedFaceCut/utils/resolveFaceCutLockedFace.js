import { Quaternion, Raycaster, Vector3 } from "three";

import { getSelectedAnnotationIds } from "Features/annotations/utils/annotationLabelSelection";
import { mesh3dLocalToWorld } from "Features/annotationMesh3d/services/getEditableMesh3d";
import getDisplayedMesh3d from "Features/annotationMesh3d/services/getDisplayedMesh3d";
import isMesh3dClosed from "Features/annotationMesh3d/utils/isMesh3dClosed";
import { mesh3dToLocal } from "Features/annotationMesh3d/utils/mesh3dFrame";
import {
  MESH3D_FACE_PART,
  getSelectedMesh3dParts,
} from "Features/annotationMesh3d/utils/mesh3dPartIds";
import {
  getFaceLoops,
  getFaceNormal,
} from "Features/annotationMesh3d/utils/mesh3dTopology";
import {
  getActiveClippingPlane,
  isWorldPointVisible,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";

import intersectLockedFacePlane from "./intersectLockedFacePlane";

// The face the "Coupe face" tools are LOCKED on: the tool launched while a
// face is selected cuts that face and no other — two glued annotations share
// coplanar faces and vertices, the hover alone cannot tell them apart.
//
// Selection part of the rule (getFaceCutLockedPart): the solo-selected
// annotation with exactly ONE selected MESH3D_FACE part (the edges selected
// with it by a double click are ignored — resolveVertexOffsetTarget's rule).
// An annotation selected without a face, or several faces: no lock.
//
// The lock is resolved against the scene (resolveFaceCutLockedFace), per
// pointer move — every input is synchronous and the displayed object may be
// rebuilt between two moves:
//
//   {
//     annotationId, baseMapId, faceIndex, isMesh3d,
//     isClosed,     // the mesh is a closed solid (back side never hit)
//     displayed,    // { mesh, baseMapGroup, baseOffsetZ }: the LOCAL mesh the
//                   // face index addresses (mesh3dLocalToWorld takes it)
//     planeWorld,   // { point, normal (outward) } of the face, world
//     loopsWorld,   // [contour, ...holes] of the face, world points
//   }
//
// A regular annotation's index addresses the conversion of its DISPLAYED
// object (getDisplayedMesh3d — the index the selection was made on); a mesh
// annotation's the stored mesh (read from the source row the 3D object was
// built from, in memory). Null when the face no longer exists on the current
// geometry (stale index until useMesh3dPartsHighlight clears the selection).

export function getFaceCutLockedPart(state) {
  const items = state.selection?.selectedItems || [];
  const ids = getSelectedAnnotationIds(items);
  if (ids.length !== 1) return null;
  const faces = getSelectedMesh3dParts(
    items[0],
    state.selection.selectedPartIds
  ).filter((part) => part.partType === MESH3D_FACE_PART);
  if (faces.length !== 1) return null;
  return { annotationId: ids[0], faceIndex: faces[0].faceIndex };
}

// Stored mesh of a mesh annotation, converted once per source row.
const storedMeshCache = new WeakMap();

function getStoredDisplayedMesh3d(editor, annotationId) {
  const sceneManager = editor?.sceneManager;
  const source =
    sceneManager?.annotationsManager?.getAnnotationSource?.(annotationId);
  if (!source?.isMesh3d) return null;
  const baseMapGroup = sceneManager.imagesManager?.getGroup?.(source.baseMapId);
  const metrics = getBaseMapForRender(
    sceneManager.imagesManager?.baseMapsMap?.[source.baseMapId]
  );
  if (!baseMapGroup || !metrics) return null;
  let mesh = storedMeshCache.get(source);
  if (!mesh) {
    mesh = mesh3dToLocal(source.mesh3d, metrics);
    storedMeshCache.set(source, mesh);
  }
  if (!mesh.faces.length) return null;
  return {
    mesh,
    baseMapGroup,
    baseOffsetZ: Number(source.offsetZ) || 0,
    baseMapId: source.baseMapId,
  };
}

// The face `faceIndex` of an annotation as displayed in the scene — what
// resolveFaceCutLockedFace returns (see above), for any (annotationId,
// faceIndex) pair, plus `planeLocal`: { point, normal } of the face in the
// base map LOCAL frame with ABSOLUTE z (the frame of a stored mesh once its
// offsetZ is added back) — the frame « Fusionner des faces » keeps its seed
// plane in. Null when the face does not exist on the current geometry.
export function resolveAnnotationFace(editor, { annotationId, faceIndex }) {
  if (!annotationId || !(faceIndex >= 0) || !editor?.sceneManager) return null;

  const source =
    editor.sceneManager.annotationsManager?.getAnnotationSource?.(annotationId);
  if (!source) return null;
  const isMesh3d = Boolean(source.isMesh3d);
  const displayed = isMesh3d
    ? getStoredDisplayedMesh3d(editor, annotationId)
    : getDisplayedMesh3d(editor, annotationId, { allowSingleFace: true });
  const face = displayed?.mesh?.faces?.[faceIndex];
  if (!face || !(face.loop?.length >= 3)) return null;

  const { mesh, baseMapGroup } = displayed;
  const baseOffsetZ = displayed.baseOffsetZ ?? 0;
  const toWorld = (vi) => {
    const p = mesh3dLocalToWorld(mesh.vertices[vi], displayed);
    return { x: p.x, y: p.y, z: p.z };
  };
  const loopsWorld = getFaceLoops(face).map((loop) => loop.map(toWorld));
  const localNormal = getFaceNormal(mesh.vertices, face);
  const normal = new Vector3(localNormal.x, localNormal.y, localNormal.z)
    .applyQuaternion(baseMapGroup.getWorldQuaternion(new Quaternion()))
    .normalize();
  const first = mesh.vertices[face.loop[0]];

  return {
    annotationId,
    baseMapId: source.baseMapId ?? displayed.baseMapId ?? null,
    faceIndex,
    isMesh3d,
    isClosed: isMesh3dClosed(mesh),
    displayed: {
      mesh,
      baseMapGroup,
      baseOffsetZ,
    },
    planeWorld: {
      point: loopsWorld[0][0],
      normal: { x: normal.x, y: normal.y, z: normal.z },
    },
    planeLocal: {
      point: { x: first.x, y: first.y, z: first.z + baseOffsetZ },
      normal: { x: localNormal.x, y: localNormal.y, z: localNormal.z },
    },
    loopsWorld,
  };
}

export default function resolveFaceCutLockedFace(state, editor) {
  const part = getFaceCutLockedPart(state);
  if (!part) return null;
  return resolveAnnotationFace(editor, part);
}

// The cursor against the locked face: { position, normal, distance, inside }
// (three.js Vector3 position / normal — the shape intersectAnnotationFace
// returns) or null. The back side of a closed solid is only reachable while
// a clipping plane exposes it; clipped points are refused.
export function intersectLockedFace(lock, ndc, camera, sceneManager) {
  if (!lock || !camera) return null;
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const { origin, direction } = raycaster.ray;
  const clipPlane = getActiveClippingPlane(sceneManager);
  const hit = intersectLockedFacePlane(
    {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
    },
    {
      point: lock.planeWorld.point,
      normal: lock.planeWorld.normal,
      loops: lock.loopsWorld,
    },
    {
      doubleSided: !lock.isClosed || Boolean(clipPlane),
      isVisible: clipPlane
        ? (p) => isWorldPointVisible(clipPlane, new Vector3(p.x, p.y, p.z))
        : null,
    }
  );
  if (!hit) return null;
  return {
    position: new Vector3(hit.position.x, hit.position.y, hit.position.z),
    normal: new Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
    distance: hit.distance,
    inside: hit.inside,
  };
}
