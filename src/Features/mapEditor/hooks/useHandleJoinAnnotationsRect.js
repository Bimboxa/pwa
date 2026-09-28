import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import computeJoinAnnotationEnds from "Features/annotations/utils/computeJoinAnnotationEnds";
import applyJoinAnnotationEndsService from "Features/annotations/services/applyJoinAnnotationEndsService";
import applyJoinAnnotationMergesService from "Features/annotations/services/applyJoinAnnotationMergesService";
import isOpeningAnnotation from "Features/annotations/utils/isOpeningAnnotation";

// "Joindre" (JOIN_ANNOTATIONS) — the user draws a selection rectangle (2
// clicks); the wall ends inside it are extended / shortened along their own
// end segment so the walls connect (corner, T, collinear gap). With the
// « Fusionner si possible » switch (mapEditor.joinMergeIfPossible), pairs of
// walls sharing the same template and width are merged into one polyline
// instead. Geometry in computeJoinAnnotationEnds, persistence in
// applyJoinAnnotationMergesService (merges) + applyJoinAnnotationEndsService
// (moves).
//
// `annotations` are the RESOLVED (pixel-space) annotations of the main base
// map. `rect` is { x, y, width, height } in local pixels. The tool stays armed
// after a rectangle (Escape leaves it).
export default function useHandleJoinAnnotationsRect({ annotations }) {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const mergeIfPossible = useSelector((s) => s.mapEditor.joinMergeIfPossible);

  const toast = (message, isError = false) =>
    dispatch(setToaster({ message, isError }));

  const handleJoinAnnotationsRect = async (rect) => {
    const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
    if (!(meterByPx > 0)) {
      toast("Le plan n'a pas d'échelle : impossible de raccorder", true);
      return { status: "no_scale" };
    }

    const candidates = (annotations || []).filter(
      (a) => !isOpeningAnnotation(a)
    );
    const { moves, merges, skipped, reason } = computeJoinAnnotationEnds({
      annotations: candidates,
      rect,
      meterByPx,
      mergeIfPossible: Boolean(mergeIfPossible),
    });

    if (!moves.length && !merges.length) {
      if (reason === "NO_END") {
        toast("Aucune extrémité à raccorder dans le cadre", true);
      } else if (skipped.some((s) => s.reason === "PX_WIDTH")) {
        toast("Largeur en pixels non prise en charge", true);
      } else {
        toast("Aucun raccord possible dans le cadre", true);
      }
      return { status: "nothing_to_join", reason };
    }

    try {
      // Merges first (they soft-delete the absorbed walls); the moves touch
      // disjoint ends, never an absorbed wall.
      const { mergedCount } = await applyJoinAnnotationMergesService({
        merges,
        annotations,
        meterByPx,
        dispatch,
      });
      const { movedCount } = await applyJoinAnnotationEndsService({
        moves,
        annotations,
        meterByPx,
        dispatch,
      });
      const parts = [];
      if (movedCount > 0)
        parts.push(
          movedCount > 1
            ? `${movedCount} extrémités raccordées`
            : "Extrémité raccordée"
        );
      if (mergedCount > 0)
        parts.push(mergedCount > 1 ? `${mergedCount} fusions` : "1 fusion");
      if (parts.length === 0) {
        toast("Échec du raccordement", true);
        return { status: "error" };
      }
      toast(parts.join(", "));
      return { status: "join_done", movedCount, mergedCount };
    } catch (e) {
      console.error("[joinAnnotations] failed", e);
      toast("Échec du raccordement", true);
      return { status: "error" };
    }
  };

  return { handleJoinAnnotationsRect };
}
