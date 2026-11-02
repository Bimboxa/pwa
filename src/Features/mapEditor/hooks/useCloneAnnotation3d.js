import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";

import createFlatMesh3dAnnotationService from "Features/annotationMesh3d/services/createFlatMesh3dAnnotationService";
import getMesh3dFaceRingsWorld from "Features/annotationMesh3d/services/getMesh3dFaceRingsWorld";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import {
  commitDrawnFace,
  FACE_COMMIT_NO_2D_ENCODING,
} from "Features/threedDrawing/services/commitDrawnFaceService";
import { commitDrawnPolyline } from "Features/threedDrawing/services/commitDrawnPolylineService";
import getAnnotationRingsWorld from "Features/threedDrawing/utils/getAnnotationRingsWorld";
import hasAnnotation3dOffsets from "Features/threedDrawing/utils/hasAnnotation3dOffsets";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import { withUndoGroup } from "App/db/undoManager";

// « Dupliquer » between a 3D line and a 3D surface, through the 3D drawing
// commits instead of the plain point copy of useCloneAnnotationAndEntity:
//
//   POLYLINE_TO_SURFACE: a polyline off its plan (per-vertex offsets, a
//     closed 3D contour) → the face it outlines: commitDrawnFace (a flat /
//     oblique POLYGON, or a vertical band), else — a vertical face the band
//     cannot reproduce — a flat mesh sheet (createFlatMesh3dAnnotationService)
//   POLYGON_TO_POLYLINES: a flat polygon off its plan → one closed 3D
//     polyline on its contour, one per cut
//   FACE_TO_POLYLINES / FACE_TO_SURFACE: the face selected in 3D (second
//     click, part MESH3D_FACE) → a closed polyline per ring / the face as a
//     surface annotation
//
// The mode of a source / target pair, or null when the plain clone applies
// (a flat annotation, a prism without a selected face, a target type the
// 3D path does not build — STRIP).
export function getClone3dMode(annotation, cloneType, facePart = null) {
  if (!annotation) return null;
  if (facePart) {
    if (cloneType === "POLYLINE") return "FACE_TO_POLYLINES";
    if (cloneType === "POLYGON") return "FACE_TO_SURFACE";
    return null;
  }
  if (annotation.isMesh3d || !hasAnnotation3dOffsets(annotation)) return null;
  if (annotation.type === "POLYLINE" && cloneType === "POLYGON") {
    return "POLYLINE_TO_SURFACE";
  }
  if (
    annotation.type === "POLYGON" &&
    cloneType === "POLYLINE" &&
    !(Number(annotation.height) > 0)
  ) {
    return "POLYGON_TO_POLYLINES";
  }
  return null;
}

const FACE_NOT_READABLE_MESSAGE =
  "Sélectionnez la face depuis la vue 3D pour la dupliquer.";
const BASE_MAP_MISSING_MESSAGE =
  "Fond de plan de l'annotation introuvable : duplication 3D impossible.";
const DEGENERATE_MESSAGE =
  "Géométrie insuffisante pour dupliquer en 3D (3 sommets distincts au moins).";
const FAILED_MESSAGE = "La copie 3D n'a pas pu être créée (voir la console).";

// Returns an async (annotation, { template, cloneType, facePart,
// keepOriginalPoints }) → true when the clone was a 3D case (handled —
// created, or refused with a toast), false when the caller must run the
// plain clone. `annotation` is the RESOLVED selected annotation (pixel
// points with their offsets), `template` the chosen annotation template,
// `cloneType` the target type of the clone menu.
export default function useCloneAnnotation3d() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  // By-id join on the source's own base map: detail / hidden-folder maps too.
  const { value: baseMaps } = useBaseMaps({
    includeDetails: true,
    includeDisabledListings: true,
  });
  const createAnnotation = useCreateAnnotation();

  return async (annotation, options = {}) => {
    const {
      template,
      cloneType,
      facePart = null,
      keepOriginalPoints = false,
    } = options;
    const mode = getClone3dMode(annotation, cloneType, facePart);
    if (!mode || !template?.id) return false;

    const refuse = (message) => {
      dispatch(setToaster({ message, severity: "warning" }));
      return true;
    };

    const baseMap = baseMaps?.find((b) => b.id === annotation.baseMapId);
    if (!baseMap) return refuse(BASE_MAP_MISSING_MESSAGE);
    const editor = getActiveThreedEditor();

    let rings;
    if (facePart) {
      rings = await getMesh3dFaceRingsWorld({
        editor,
        annotation,
        faceIndex: facePart.faceIndex,
        baseMap,
      });
      if (!rings) return refuse(FACE_NOT_READABLE_MESSAGE);
    } else {
      rings = getAnnotationRingsWorld(annotation, baseMap);
    }
    const contour = rings?.[0]?.ring ?? [];
    if (contour.length < 3) return refuse(DEGENERATE_MESSAGE);

    // The armed draft of the same template drawn in 3D (2D parity: a flat
    // face takes the template's extrusion height).
    const templateProps = {
      ...getNewAnnotationPropsFromAnnotationTemplate(template),
      type: cloneType,
      annotationTemplateId: template.id,
    };
    const listingId = template.listingId ?? null;
    const layerId = activeLayerId ?? null;
    const common = {
      baseMaps: [baseMap],
      preferredBaseMapId: baseMap.id,
      projectId,
      listingId,
      scopeId,
      templateProps,
      layerId,
      createAnnotationFn: createAnnotation,
      // « Conserver les points d'origine »: the copy shares the source's
      // db.points (a drag moves both, like two faces drawn on one vertex);
      // unchecked, it gets points of its own.
      reuseExistingPoints: Boolean(keepOriginalPoints),
    };

    const created = await withUndoGroup(async () => {
      if (cloneType === "POLYGON") {
        const holes = rings.slice(1).map((r) => r.ring);
        const { annotation: face, reason } = await commitDrawnFace({
          ...common,
          cornersInOrder: contour,
          holes,
        });
        if (face) return [face];
        if (reason !== FACE_COMMIT_NO_2D_ENCODING) return [];
        if (holes.length) {
          console.warn(
            "[clone3d] mesh sheet fallback drops the holes of the contour"
          );
        }
        const sheet = await createFlatMesh3dAnnotationService({
          editor,
          vertices: contour,
          baseMaps: [baseMap],
          preferredBaseMapId: baseMap.id,
          projectId,
          scopeId,
          listingId,
          draftProps: templateProps,
          layerId,
          createAnnotationFn: createAnnotation,
        });
        return sheet ? [sheet] : [];
      }
      const lines = [];
      for (const { ring } of rings) {
        if (ring.length < 2) continue;
        const { annotation: line } = await commitDrawnPolyline({
          ...common,
          verticesInOrder: ring,
          closeLine: true,
        });
        if (line) lines.push(line);
      }
      return lines;
    });

    if (!created.length) return refuse(FAILED_MESSAGE);
    return true;
  };
}
