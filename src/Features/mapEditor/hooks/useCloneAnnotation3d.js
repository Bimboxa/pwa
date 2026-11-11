import { useDispatch, useSelector } from "react-redux";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";

import createFlatMesh3dAnnotationService from "Features/annotationMesh3d/services/createFlatMesh3dAnnotationService";
import getMesh3dPartsWorld from "Features/annotationMesh3d/services/getMesh3dPartsWorld";
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
//
// and from the faces / edges selected in 3D (parts MESH3D_FACE / MESH3D_EDGE:
// one face by a second click, the whole block by a double-click, shift+clicks):
//
//   FACES_TO_SURFACES: every selected face → a surface annotation
//   FACES_TO_POLYLINES: no edge selected — every selected face → a closed
//     polyline per ring
//   EDGES_TO_POLYLINES: every selected edge → ONE two-point polyline
//
// A mixed selection follows the target type: Surface takes the faces, Ligne
// the edges.
//
// The mode of a source / target pair, or null when the plain clone applies
// (a flat annotation, a prism without a selected part, a target type the
// 3D path does not build — STRIP).
//
// parts: { faceIndices, edges } (ctx.mesh3dParts) or null.
export function getClone3dMode(annotation, cloneType, parts = null) {
  if (!annotation) return null;
  const faceCount = parts?.faceIndices?.length ?? 0;
  const edgeCount = parts?.edges?.length ?? 0;
  if (faceCount || edgeCount) {
    if (cloneType === "POLYGON") return faceCount ? "FACES_TO_SURFACES" : null;
    if (cloneType === "POLYLINE") {
      return edgeCount ? "EDGES_TO_POLYLINES" : "FACES_TO_POLYLINES";
    }
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

const PARTS_NOT_READABLE_MESSAGE =
  "Sélectionnez les faces / arêtes depuis la vue 3D pour les dupliquer.";
const BASE_MAP_MISSING_MESSAGE =
  "Fond de plan de l'annotation introuvable : duplication 3D impossible.";
const DEGENERATE_MESSAGE =
  "Géométrie insuffisante pour dupliquer en 3D (3 sommets distincts au moins).";
const FAILED_MESSAGE = "La copie 3D n'a pas pu être créée (voir la console).";

const getCreatedMessage = (created, expected) => {
  const countS =
    created > 1 ? `${created} annotations créées` : "1 annotation créée";
  const skipped = expected - created;
  return skipped > 0 ? `${countS} (${skipped} non reproduite(s))` : countS;
};

// Returns an async (annotation, { template, cloneType, mesh3dParts,
// keepOriginalPoints }) → true when the clone was a 3D case (handled —
// created, or refused with a toast), false when the caller must run the
// plain clone. `annotation` is the RESOLVED selected annotation (pixel
// points with their offsets), `template` the chosen annotation template,
// `cloneType` the target type of the clone menu, `mesh3dParts` the faces /
// edges selected in 3D ({ faceIndices, edges }).
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
      mesh3dParts = null,
      keepOriginalPoints = false,
    } = options;
    const mode = getClone3dMode(annotation, cloneType, mesh3dParts);
    if (!mode || !template?.id) return false;

    const refuse = (message) => {
      dispatch(setToaster({ message, severity: "warning" }));
      return true;
    };

    const baseMap = baseMaps?.find((b) => b.id === annotation.baseMapId);
    if (!baseMap) return refuse(BASE_MAP_MISSING_MESSAGE);
    const editor = getActiveThreedEditor();

    // The sources, in world space: faces as ring lists (contour first, then
    // holes), edges as two-vertex lines.
    let faceRings = [];
    let edgeLines = [];
    const fromParts =
      mode === "FACES_TO_SURFACES" ||
      mode === "FACES_TO_POLYLINES" ||
      mode === "EDGES_TO_POLYLINES";
    if (fromParts) {
      const isEdges = mode === "EDGES_TO_POLYLINES";
      const world = await getMesh3dPartsWorld({
        editor,
        annotation,
        baseMap,
        faceIndices: isEdges ? [] : mesh3dParts.faceIndices,
        edges: isEdges ? mesh3dParts.edges : [],
      });
      if (!world) return refuse(PARTS_NOT_READABLE_MESSAGE);
      faceRings = world.faces.map((face) => face.rings);
      edgeLines = world.edges.map((edge) => edge.vertices);
      if (!faceRings.length && !edgeLines.length) {
        return refuse(PARTS_NOT_READABLE_MESSAGE);
      }
    } else {
      const rings = getAnnotationRingsWorld(annotation, baseMap);
      if ((rings?.[0]?.ring ?? []).length < 3) {
        return refuse(DEGENERATE_MESSAGE);
      }
      faceRings = [rings];
    }

    // The armed draft of the same template drawn in 3D (2D parity: a flat
    // face takes the template's extrusion height).
    const templateProps = {
      ...getNewAnnotationPropsFromAnnotationTemplate(template),
      type: cloneType,
      annotationTemplateId: template.id,
    };
    const listingId = template.listingId ?? null;
    const layerId = activeLayerId ?? null;
    // One trigger for the whole batch, dispatched after the last write.
    const createQuietly = (row, createOptions) =>
      createAnnotation(row, { ...createOptions, skipTriggers: true });
    const common = {
      baseMaps: [baseMap],
      preferredBaseMapId: baseMap.id,
      projectId,
      listingId,
      scopeId,
      templateProps,
      layerId,
      createAnnotationFn: createQuietly,
      // « Conserver les points d'origine »: the copy shares the source's
      // db.points (a drag moves both, like two faces drawn on one vertex);
      // unchecked, it gets points of its own.
      reuseExistingPoints: Boolean(keepOriginalPoints),
      // Either way the copies of one batch share THEIR corners: two neighbor
      // faces / edges stay connected.
      batchPointIds: new Set(),
    };

    const createSurface = async (rings) => {
      const contour = rings[0].ring;
      const holes = rings.slice(1).map((r) => r.ring);
      const { annotation: face, reason } = await commitDrawnFace({
        ...common,
        cornersInOrder: contour,
        holes,
      });
      if (face) return face;
      if (reason !== FACE_COMMIT_NO_2D_ENCODING) return null;
      if (holes.length) {
        console.warn(
          "[clone3d] mesh sheet fallback drops the holes of the contour"
        );
      }
      return await createFlatMesh3dAnnotationService({
        editor,
        vertices: contour,
        baseMaps: [baseMap],
        preferredBaseMapId: baseMap.id,
        projectId,
        scopeId,
        listingId,
        draftProps: templateProps,
        layerId,
        createAnnotationFn: createQuietly,
      });
    };

    let expected = 0;
    const created = await withUndoGroup(async () => {
      const out = [];
      if (mode === "EDGES_TO_POLYLINES") {
        expected = edgeLines.length;
        for (const vertices of edgeLines) {
          // An edge stays a line on the mesh: no template extrusion height.
          const { annotation: line } = await commitDrawnPolyline({
            ...common,
            verticesInOrder: vertices,
            closeLine: false,
            ignoreTemplateHeight: true,
          });
          if (line) out.push(line);
        }
        return out;
      }
      if (cloneType === "POLYGON") {
        expected = faceRings.length;
        for (const rings of faceRings) {
          const surface = await createSurface(rings);
          if (surface) out.push(surface);
        }
        return out;
      }
      for (const rings of faceRings) {
        for (const { ring } of rings) {
          if (ring.length < 2) continue;
          expected += 1;
          const { annotation: line } = await commitDrawnPolyline({
            ...common,
            verticesInOrder: ring,
            closeLine: true,
          });
          if (line) out.push(line);
        }
      }
      return out;
    });

    if (created.length) {
      dispatch(triggerAnnotationsUpdate());
      dispatch(triggerAnnotationTemplatesUpdate());
    }
    if (!created.length) return refuse(FAILED_MESSAGE);
    if (fromParts && expected > 1) {
      dispatch(
        setToaster({
          message: getCreatedMessage(created.length, expected),
          severity: created.length < expected ? "warning" : "success",
        })
      );
    }
    return true;
  };
}
