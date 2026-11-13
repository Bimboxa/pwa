import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import db from "App/db/db";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { TYPES_SUPPORTING_REVOLUTION } from "Features/annotations/constants/shape3DConfig";
import isRevolutionHelperInScope, {
  getScopeIdByListingId,
} from "Features/annotations/utils/isRevolutionHelperInScope";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Revolution axis a 2D drawing may be revolved around: the axis PLACED on the
// main base map (its inverted-T clone, REVOLUTION_AXIS_PLACEMENT of the
// selected scope), while the armed draft is of a type that revolves
// (POLYLINE profile, POINT circle) and is not an opening.
//
// Returns { axis: { id, label } | null, enabled } — `enabled`: the
// « Révolution » switch of the drawing helper (mapEditor.revolutionOnCommit,
// on by default). Shared by the helper section (SectionDrawingShape3D), the R
// hotkey (useDrawingToolHotkeys) and the commit (useHandleCommitDrawing),
// which stamps shape3D = { key: "REVOLUTION", axisAnnotationId } on the new
// annotation when both are set.
export default function useDrawingRevolutionAxis() {
  // data

  const baseMap = useMainBaseMap();
  const baseMapId = baseMap?.id ?? null;
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const enabled = useSelector((s) => s.mapEditor.revolutionOnCommit);
  const isDrawing = useSelector((s) => Boolean(s.mapEditor.enabledDrawingMode));
  const isThreedEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  const draftRevolves = useSelector((s) => {
    const draft = s.annotations.newAnnotation;
    return (
      TYPES_SUPPORTING_REVOLUTION.includes(draft?.type) &&
      !draft?.isOpening &&
      !draft?.isBaseMapAnnotation
    );
  });
  const active = isDrawing && !isThreedEditor && draftRevolves;

  const axis = useLiveQuery(async () => {
    if (!active || !baseMapId) return null;
    const placements = await db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .filter(
        (a) =>
          a.type === "REVOLUTION_AXIS_PLACEMENT" &&
          a.revolutionAxisId &&
          !a.deletedAt
      )
      .toArray();
    if (!placements.length) return null;
    const scopeIdByListingId = await getScopeIdByListingId(placements);
    const placement = placements.find((a) =>
      isRevolutionHelperInScope(a, { scopeId, scopeIdByListingId })
    );
    if (!placement) return null;
    const row = await db.annotations.get(placement.revolutionAxisId);
    if (!row || row.deletedAt) return null;
    return { id: row.id, label: row.label ?? null };
  }, [active, baseMapId, scopeId, annotationsUpdatedAt]);

  return { axis: active ? (axis ?? null) : null, enabled: Boolean(enabled) };
}
