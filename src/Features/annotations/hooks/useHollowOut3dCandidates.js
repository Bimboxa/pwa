import { useEffect, useRef, useState } from "react";

import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { getAnnotationFootprintMultiPolygonOnBaseMap } from "Features/threedEditor/js/utilsAnnotationsManager/getAnnotationFootprintOnBaseMap";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import getIntersectingAnnotationsAsync from "Features/threedEditor/js/utilsAnnotationsManager/getIntersectingAnnotationsAsync";

import { isForeignFootprintId } from "../constants/foreignFootprint";
import { isOpenTopPrism } from "../constants/shape3DConfig";
import isHollowSubtractionHost from "../utils/isHollowSubtractionHost";

// What can carve: the annotation types that build a volume in 3D.
const CUTTER_TYPES = ["POLYGON", "RECTANGLE", "POLYLINE", "STRIP"];

const LOADING = {
  loading: true,
  host: null,
  hostFootprint: null,
  candidates: [],
  footprintById: new Map(),
  existingFootprints: [],
};

const getSubtractionTargetIds = (annotation) =>
  annotation?.subtractionTargetIds ??
  (annotation?.subtractionTargets ?? []).map((t) => t?.id).filter(Boolean);

// An open sheet bounds no volume: it cannot carve. A « Fosse » is carved as
// its closed prism (asClosedSolidOperand), so it stays a valid cutter.
const isVolumeCutter = (annotation) =>
  isOpenTopPrism(annotation) || !isHollowSubtractionHost(annotation);

/**
 * Data of the « Évider » dialog of the 3D editor, computed ONCE when the
 * dialog opens (heavy: one 3D boolean per nearby annotation):
 *  - `candidates`: the annotations displayed in the 3D scene whose solid cuts
 *    into the host's (any base map), not subtracted from it yet;
 *  - `hostFootprint` / `footprintById` / `existingFootprints`: the projection
 *    of the host, of each candidate and of the host's existing subtractions on
 *    the HOST base map (polygon-clipping MultiPolygons, reference pixels);
 *    `existingFootprints` = [{ annotation, footprint }].
 *
 * @param {Object} args
 * @param {string} args.annotationId the host
 * @param {Array<Object>} args.annotations the annotations loaded in the 3D
 *   editor (resolved: pixel points, template fields applied)
 */
export default function useHollowOut3dCandidates({
  annotationId,
  annotations,
}) {
  // state

  const [result, setResult] = useState(LOADING);

  // helpers

  const annotationsRef = useRef(annotations);
  useEffect(() => {
    annotationsRef.current = annotations;
  });

  const hasHost = Boolean(annotations?.some((a) => a.id === annotationId));

  useEffect(() => {
    if (!hasHost) return undefined;
    let cancelled = false;

    async function compute() {
      // Let the dialog paint its spinner before the heavy pass.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (cancelled) return;

      const all = annotationsRef.current ?? [];
      const host = all.find((a) => a.id === annotationId);
      const editor = getActiveThreedEditor();
      const baseMapsById = editor?.sceneManager?.imagesManager?.baseMapsMap;
      const buildOptions =
        editor?.sceneManager?.annotationsManager?.getBuildOptions?.();
      const getBaseMap = (id) =>
        baseMapsById instanceof Map ? baseMapsById.get(id) : baseMapsById?.[id];
      const hostBaseMap = getBaseMap(host?.baseMapId);
      const hostForRender = getBaseMapForRender(hostBaseMap);
      if (!host || !hostForRender) {
        setResult({ ...LOADING, loading: false, host: host ?? null });
        return;
      }
      const hostTransform = getBaseMapTransform(hostBaseMap);

      const existingIds = new Set(getSubtractionTargetIds(host));
      const pool = all.filter(
        (a) =>
          a?.id &&
          a.id !== host.id &&
          CUTTER_TYPES.includes(a.type) &&
          !isForeignFootprintId(a.id) &&
          !existingIds.has(a.id) &&
          // Never close a cycle: an annotation the host is carved out of.
          !getSubtractionTargetIds(a).includes(host.id) &&
          isVolumeCutter(a)
      );

      const hits = await getIntersectingAnnotationsAsync({
        host,
        candidates: pool,
        baseMapsById,
        buildOptions,
        isCancelled: () => cancelled,
      });
      if (cancelled) return;

      const getFootprint = (annotation) => {
        const baseMap = getBaseMap(annotation.baseMapId);
        const forRender =
          annotation._baseMapForRender ?? getBaseMapForRender(baseMap);
        const transform =
          annotation._baseMapTransform ??
          (baseMap ? getBaseMapTransform(baseMap) : null);
        if (!forRender || !transform) return null;
        return getAnnotationFootprintMultiPolygonOnBaseMap({
          annotation,
          forRender,
          transform,
          hostForRender,
          hostTransform,
        });
      };

      const hostFootprint = await getFootprint(host);
      const footprintById = new Map();
      const existingFootprints = [];
      // No footprint at all when the host is seen edge-on: skip the cutters.
      if (hostFootprint) {
        for (const { annotation } of hits) {
          if (cancelled) return;
          footprintById.set(annotation.id, await getFootprint(annotation));
        }
        for (const target of host.subtractionTargets ?? []) {
          if (cancelled) return;
          const footprint = target ? await getFootprint(target) : null;
          if (footprint)
            existingFootprints.push({ annotation: target, footprint });
        }
      }
      if (cancelled) return;

      setResult({
        loading: false,
        host,
        hostFootprint,
        candidates: hits.map((hit) => hit.annotation),
        footprintById,
        existingFootprints,
      });
    }

    compute().catch((e) => {
      console.error("[useHollowOut3dCandidates] failed", e);
      if (!cancelled) setResult({ ...LOADING, loading: false });
    });

    return () => {
      cancelled = true;
    };
  }, [annotationId, hasHost]);

  return result;
}
