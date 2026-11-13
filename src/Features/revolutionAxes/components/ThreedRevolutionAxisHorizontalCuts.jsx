import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Group, Plane, Vector2, Vector3 } from "three";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import db from "App/db/db";
import { isRevolutionHelperType } from "Features/annotations/constants/drawingShapeConfig";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import getAnnotationVerticalLift from "Features/threedEditor/js/utilsAnnotationsManager/getAnnotationVerticalLift";
import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";
import computePlaneSectionSegments from "Features/threedEditor/js/utilsClipping/computePlaneSectionSegments";
import { collectObjectSectionMeshes } from "Features/threedEditor/js/utilsClipping/collectAnnotationSectionMeshes";
import { closestPointOnAxis } from "Features/threedDrawing/utils/computeSnapTarget";
import { disposeObject } from "Features/threedDrawing/utils/drawingOverlayLines";
import { setRevolutionAxisCuts } from "Features/revolutionAxes/services/revolutionAxisCutsStore";
import getRevolutionAxisIdOfAnnotation from "Features/revolutionAxes/utils/getRevolutionAxisIdOfAnnotation";
import getRevolutionAxisHorizontalCutZ from "Features/revolutionAxes/utils/getRevolutionAxisHorizontalCutZ";
import createRevolutionAxisHandleSprite from "Features/revolutionAxes/utils/createRevolutionAxisHandleSprite";

// Same ink as the section markers of the half-view (buildRevolutionMesh).
const CONTOUR_COLOR = 0x2a2a2a;
const CONTOUR_LINEWIDTH_PX = 2.5;

const EMPTY = [];

// World frame of a revolution axis: { base, up } — the base point of the
// axis and its unit direction (upward). Read from the axis object itself
// when its plan base map is in the scene, else from the lathe meshes revolved
// around it (userData.revolutionAxis, mesh frame — buildRevolutionMesh).
function getAxisWorldFrame({ axis, roots, sceneManager }) {
  const imagesManager = sceneManager.imagesManager;
  if (axis?.point) {
    const entry = imagesManager?.baseMapsMap?.[axis.baseMapId];
    const group = imagesManager?.getGroup?.(axis.baseMapId);
    const metrics = entry ? getBaseMapForRender(entry) : null;
    if (group && metrics) {
      const center = pixelToWorld(axis.point, metrics);
      const buildOptions = sceneManager.annotationsManager?.getBuildOptions?.();
      group.updateMatrixWorld(true);
      return {
        base: group.localToWorld(
          new Vector3(
            center.x,
            center.y,
            getAnnotationVerticalLift(axis, buildOptions)
          )
        ),
        up: new Vector3(0, 0, 1).transformDirection(group.matrixWorld),
      };
    }
  }
  for (const root of roots) {
    let frame = null;
    root.updateMatrixWorld(true);
    root.traverse((child) => {
      const meshAxis = child.userData?.revolutionAxis;
      if (frame || !meshAxis?.center) return;
      frame = {
        base: child.localToWorld(
          new Vector3(meshAxis.center.x, meshAxis.center.y, meshAxis.center.z)
        ),
        up: (meshAxis.axisAlongNormal
          ? new Vector3(0, 0, 1)
          : new Vector3(0, 1, 0)
        ).transformDirection(child.matrixWorld),
      };
    });
    if (frame) return frame;
  }
  return null;
}

/**
 * Horizontal cuts of the revolution axes in the 3D editor (axis rows of
 * SectionRevolutionAxes, `horizontalCutIn3d` / `horizontalCutZ` on the axis):
 * for each axis with the cut on, whatever is revolved around it is not shown
 * above the horizontal plane at `horizontalCutZ` (metres above the base of
 * the axis). Display only — a clipping plane on the materials of those
 * annotations (ClippingManager.setAnnotationPlanes), the geometry and the
 * quantities are untouched. The cut is drawn as an ink contour on the plane
 * (plane section of the meshes, like the half-view markers) and a handle on
 * the axis at the cut altitude, dragged along the axis — see
 * useRevolutionAxisCutHandleDragHandlers.
 *
 * `annotations`: the resolved annotations loaded in 3D.
 */
export default function ThreedRevolutionAxisHorizontalCuts({ annotations }) {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  // Read from Dexie: the axis row is not part of the scene when its plan
  // base map is not (a coupe base map alone).
  const cutAxes = useLiveQuery(async () => {
    if (!projectId) return EMPTY;
    const rows = await db.annotations
      .where("projectId")
      .equals(projectId)
      .filter(
        (a) =>
          a.type === "REVOLUTION_AXIS" &&
          a.horizontalCutIn3d === true &&
          !a.deletedAt
      )
      .toArray();
    return rows.map((a) => ({
      id: a.id,
      z: getRevolutionAxisHorizontalCutZ(a),
    }));
  }, [projectId, annotationsUpdatedAt]);

  // Re-run once loadAnnotations has (re)built the annotation objects.
  const annotationsLoadTick = useSelector(
    (s) => s.threedEditor.annotationsLoadTick
  );
  const antiAliasingShrink = useSelector(
    (s) => s.threedEditor.antiAliasingShrink
  );

  // helpers

  const cutsKey = (cutAxes ?? EMPTY)
    .map((c) => `${c.id}:${c.z}`)
    .sort()
    .join("|");
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  // Whether ClippingManager currently holds planes of ours (cleared lazily:
  // a rebuild swaps them in one call, so the plane count of the materials —
  // a shader define — does not flip to 0 and back).
  const hasPlanesRef = useRef(false);

  // effects

  useEffect(() => {
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const annotationsManager = sceneManager?.annotationsManager;
    const clippingManager = sceneManager?.clippingManager;
    if (!annotationsManager || !clippingManager) return;
    if (!cutsKey) {
      if (hasPlanesRef.current) clippingManager.setAnnotationPlanes({});
      hasPlanesRef.current = false;
      return;
    }

    const loaded = annotationsRef.current || [];
    const group = new Group();
    group.userData.isRevolutionAxisCutsGroup = true;
    const planesByAnnotationId = {};
    const cuts = [];

    const getResolution = () => {
      const dom = sceneManager.renderer?.domElement;
      return new Vector2(dom?.clientWidth || 1, dom?.clientHeight || 1);
    };

    cutsKey.split("|").forEach((item) => {
      const [axisId, zString] = item.split(":");
      const linkedIds = loaded
        .filter(
          (a) =>
            !isRevolutionHelperType(a.type) &&
            getRevolutionAxisIdOfAnnotation(a) === axisId
        )
        .map((a) => a.id);
      const getRoots = () =>
        linkedIds
          .map((id) => annotationsManager.annotationsObjectsMap?.[id])
          .filter(Boolean);
      const roots = getRoots();
      if (!roots.length) return;
      const frame = getAxisWorldFrame({
        axis: loaded.find((a) => a.id === axisId),
        roots,
        sceneManager,
      });
      if (!frame) return;
      const { base, up } = frame;

      // Normal pointing DOWN: three.js keeps the positive side of a
      // clipping plane, i.e. what is below the cut.
      const normal = up.clone().negate();
      const plane = new Plane();
      linkedIds.forEach((id) => {
        (planesByAnnotationId[id] ??= []).push(plane);
      });

      const geometry = new LineSegmentsGeometry();
      const material = new LineMaterial({
        color: CONTOUR_COLOR,
        linewidth: CONTOUR_LINEWIDTH_PX,
        resolution: getResolution(),
        worldUnits: false,
      });
      const contour = new LineSegments2(geometry, material);
      // Display only: never picked, sectioned, exported or sliced.
      contour.raycast = () => {};
      contour.userData.isSectionMarker = true;
      contour.userData.isHoverOverlay = true;
      contour.frustumCulled = false;
      contour.visible = false;
      group.add(contour);

      const handle = createRevolutionAxisHandleSprite();
      handle.userData.isRevolutionAxisCutHandle = true;
      handle.userData.isHoverOverlay = true;
      group.add(handle);

      const cut = {
        axisId,
        // Objects of the annotations revolved around the axis (the cut ones).
        getRoots,
        handle,
        z: 0,
        // Preview: the plane, the handle and the contour follow `z`.
        setZ(z) {
          cut.z = Math.max(0, z);
          const point = base.clone().addScaledVector(up, cut.z);
          plane.setFromNormalAndCoplanarPoint(normal, point);
          handle.position.copy(point);
          cut.refreshContour();
        },
        refreshContour() {
          const meshes = [];
          getRoots().forEach((root) => {
            root.updateMatrixWorld(true);
            collectObjectSectionMeshes(root, { visibleOnly: true }, meshes);
          });
          const { positions } = computePlaneSectionSegments(plane, meshes);
          if (positions.length > 0) {
            geometry.setPositions(positions);
            contour.visible = true;
          } else {
            contour.visible = false;
          }
          material.resolution.copy(getResolution());
        },
        zOfWorldPoint: (point) => point.clone().sub(base).dot(up),
        zOfRay(ray) {
          const point = closestPointOnAxis(ray.origin, ray.direction, base, up);
          return point ? cut.zOfWorldPoint(point) : null;
        },
      };
      cut.setZ(Number(zString) || 0);
      cuts.push(cut);
    });

    sceneManager.scene.add(group);
    clippingManager.setAnnotationPlanes(planesByAnnotationId);
    hasPlanesRef.current = true;
    setRevolutionAxisCuts(cuts);

    // Objects rebuilt after the load (async carve, …): the contour follows
    // (their materials are re-clipped by ClippingManager itself).
    const unsubscribe = annotationsManager.subscribeAnnotationReady?.(() => {
      cuts.forEach((cut) => cut.refreshContour());
      sceneManager.renderScene?.();
    });
    sceneManager.renderScene?.();

    return () => {
      unsubscribe?.();
      setRevolutionAxisCuts([]);
      group.parent?.remove(group);
      group.traverse((child) => child.userData?.dispose?.());
      disposeObject(group);
    };
  }, [cutsKey, annotationsLoadTick, antiAliasingShrink]);

  // Unmount: the planes go with the component.
  useEffect(
    () => () => {
      if (!hasPlanesRef.current) return;
      getActiveThreedEditor()?.sceneManager?.clippingManager?.setAnnotationPlanes(
        {}
      );
      hasPlanesRef.current = false;
    },
    []
  );

  return null;
}
