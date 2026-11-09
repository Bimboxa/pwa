import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";
import { getScopeIdByListingId } from "Features/annotations/utils/isRevolutionHelperInScope";
import readProfileSourceDrawing from "Features/elevation/utils/readProfileSourceDrawing";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

// Profile DRAWINGS of the current project and scope — the annotations flagged
// « Profil » (annotation.isProfile, the Propriétés switch; the same list as
// the « Ajouter un profil » command, see listProfileAnnotations) — as live
// menu entries { id, label, drawing } for the « Forme par défaut » tiles.
//
// Scope rule (mirrors isRevolutionHelperInScope): a template-driven row
// follows its LISTING's scopeId; a templateless row carries its own scopeId
// (none = visible in every scope); no selected scope → everything.
//
// `drawing` is readProfileSourceDrawing's result (pixel vertices, visible
// run, base point) feeding ProfileThumbnail — null when the source cannot be
// read (the tile then shows a placeholder; the apply service decides).
//
// `excludeIds`: the selected annotations themselves (a profile cannot be
// applied on itself).
export default function useProfileAnnotations({ excludeIds = [] } = {}) {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const { value: scope } = useSelectedScope();
  const scopeId = scope?.id;
  const excludeKey = excludeIds.join(",");

  const profiles = useLiveQuery(async () => {
    if (!projectId) return [];
    const exclude = new Set(excludeIds);
    const rows = (
      await db.annotations.where("projectId").equals(projectId).toArray()
    ).filter((a) => Boolean(a.isProfile) && !a.deletedAt && !exclude.has(a.id));
    if (!rows.length) return [];

    const scopeIdByListingId = await getScopeIdByListingId(rows);
    const inScope = rows.filter((a) => {
      if (!scopeId) return true;
      if (a.annotationTemplateId)
        return scopeIdByListingId.get(a.listingId) === scopeId;
      return !a.scopeId || a.scopeId === scopeId;
    });
    if (!inScope.length) return [];

    const templateIds = [
      ...new Set(inScope.map((a) => a.annotationTemplateId).filter(Boolean)),
    ];
    const templates = templateIds.length
      ? (await db.annotationTemplates.bulkGet(templateIds)).filter(Boolean)
      : [];
    const templateById = new Map(templates.map((t) => [t.id, t]));

    const baseMapIds = [
      ...new Set(inScope.map((a) => a.baseMapId).filter(Boolean)),
    ];
    const baseMaps = (await db.baseMaps.bulkGet(baseMapIds)).filter(Boolean);
    const baseMapById = new Map(baseMaps.map((b) => [b.id, b]));

    const pointIds = inScope.flatMap((a) =>
      (a.points ?? []).map((p) => p?.id).filter(Boolean)
    );
    const pointRows = pointIds.length ? await db.points.bulkGet(pointIds) : [];
    const pointById = new Map(pointRows.filter(Boolean).map((p) => [p.id, p]));

    return inScope
      .map((a) => {
        const srcRows = (a.points ?? []).map((p) =>
          p?.id ? pointById.get(p.id) : undefined
        );
        return {
          id: a.id,
          label:
            a.label ||
            templateById.get(a.annotationTemplateId)?.label ||
            "Sans nom",
          drawing: readProfileSourceDrawing({
            src: a,
            srcRows,
            srcBaseMap: baseMapById.get(a.baseMapId),
          }),
        };
      })
      .sort((x, y) => x.label.localeCompare(y.label, "fr"));
  }, [projectId, annotationsUpdatedAt, scopeId, excludeKey]);

  return profiles ?? [];
}
