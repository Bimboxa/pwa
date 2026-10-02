import { useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";

import cutSurfaceAlongPathService from "../services/cutSurfaceAlongPathService";

// Commit of a « Couper une surface » trace (2D editor). The surfaces cut are
// the selected POLYGON annotations when there are some, otherwise every
// visible POLYGON the trace runs across.
//
// annotations: the list the editor renders (visible, pixel points);
// selectedNodes: the selection items of the map.
export default function useHandleSurfaceCutCommit({
  annotations,
  selectedNodes,
}) {
  const dispatch = useDispatch();

  // strings

  const noCutByReasonS = {
    NO_CROSSING: "Aucune surface coupée : le trait ne traverse aucune surface.",
    NOT_THROUGH:
      "Aucune surface coupée : le trait doit traverser la surface de part en part.",
    SELF_INTERSECTING:
      "Aucune surface coupée : le trait ne doit pas se recouper.",
    ARC: "Aucune surface coupée : la coupe d'un arc de cercle n'est pas prise en charge.",
    ROTATED:
      "Aucune surface coupée : une surface tournée ne peut pas être coupée.",
    HOST: "Aucune surface coupée : la surface porte des ouvertures ou des soustractions.",
    NOT_EDITABLE: "Aucune surface coupée : ce maillage ne peut pas être lu.",
    FAILED: "La coupe de la surface n'a pas pu être enregistrée.",
  };
  const readOnlyS =
    "Aucune surface coupée : ces surfaces sont en lecture seule.";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMap = useMainBaseMap();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const { isReadOnly: isReadOnlyScope } = useReadOnlyScope();
  const { canEditAnnotation } = useAnnotationPermissions({ annotations });

  // state

  const busyRef = useRef(false);

  // helpers

  function getCandidateIds(points) {
    const surfaces = (annotations ?? []).filter(
      (a) =>
        a?.type === "POLYGON" &&
        !a.isMeshCell &&
        !a.isForeignFootprint &&
        a.points?.length >= 3
    );
    const selectedIds = new Set(
      (selectedNodes ?? [])
        .filter((node) => node?.nodeType === "ANNOTATION")
        .map((node) => node.nodeId ?? node.id)
    );
    const selected = surfaces.filter((a) => selectedIds.has(a.id));
    if (selected.length) return selected.map((a) => a.id);

    const box = getBox(points);
    return surfaces
      .filter((a) => boxesOverlap(box, getBox(a.points)))
      .map((a) => a.id);
  }

  // handlers

  return async function handleSurfaceCutCommit(points) {
    if (busyRef.current || !points || points.length < 2) return;
    const { width, height } = baseMap?.getImageSize?.() ?? {};
    if (!width || !height) return;

    const candidateIds = getCandidateIds(points);
    const editableIds = isReadOnlyScope
      ? []
      : candidateIds.filter((id) => canEditAnnotation(id, { silent: true }));
    if (!editableIds.length) {
      dispatch(
        setToaster({
          message: candidateIds.length ? readOnlyS : noCutByReasonS.NO_CROSSING,
          severity: "warning",
        })
      );
      return;
    }

    busyRef.current = true;
    try {
      const result = await cutSurfaceAlongPathService({
        annotationIds: editableIds,
        path: points.map((p) => ({ x: p.x / width, y: p.y / height })),
        projectId,
        dispatch,
        createAnnotationFn: createAnnotation,
        updateAnnotationFn: updateAnnotation,
      });
      if (!result.cutCount) {
        dispatch(
          setToaster({
            message: noCutByReasonS[result.reason] ?? noCutByReasonS.FAILED,
            severity: result.reason === "FAILED" ? "error" : "warning",
          })
        );
      }
    } catch (error) {
      console.error("[surfaceCut] commit failed", error);
      dispatch(
        setToaster({ message: noCutByReasonS.FAILED, severity: "error" })
      );
    } finally {
      busyRef.current = false;
    }
  };
}

function getBox(points) {
  const box = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  for (const p of points ?? []) {
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) continue;
    box.minX = Math.min(box.minX, p.x);
    box.minY = Math.min(box.minY, p.y);
    box.maxX = Math.max(box.maxX, p.x);
    box.maxY = Math.max(box.maxY, p.y);
  }
  return box;
}

function boxesOverlap(a, b) {
  return (
    a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY
  );
}
