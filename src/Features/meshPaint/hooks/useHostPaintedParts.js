import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import usePaintedPartsQties from "Features/meshPaint/hooks/usePaintedPartsQties";

import { MESH_BRUSH_AUTO_GEN_KIND } from "Features/meshPaint/services/commitMeshBrush2dService";
import { MESH_PAINT_PART_TYPES } from "Features/meshPaint/constants/meshPaintConstants";

const EMPTY = Object.freeze({ groups: Object.freeze([]), count: 0 });
const NO_IDS = Object.freeze([]);

/**
 * Painted parts of ONE host annotation, grouped by painting template — the
 * « Parties peintes » section of the host's properties panel:
 *   - the db.meshPaints rows painted on it (usePaintedPartsQties: same layer
 *     / POV filters as the quantity consumers, own template eye ignored so a
 *     hidden template's paints stay listed);
 *   - the 2D annotations the brush created on it instead of a paint
 *     (autoCreatedFrom = host, autoGenKind MESH_BRUSH), with their own
 *     quantities (useAnnotationsV2 withQties, only queried when such
 *     annotations exist).
 *
 * @param {Object|null} annotation - the host (raw or resolved row).
 * @returns {{
 *   groups: Array<{
 *     templateId: string, template: Object|null,
 *     parts: Array<Object>,        // resolvePaintedParts items
 *     annotations: Array<Object>,  // resolved annotations (qties)
 *     facesCount: number, edgesCount: number,
 *     linesCount: number, polygonsCount: number,
 *     surface: number, length: number,
 *   }>,
 *   count: number,
 * }}
 */
export default function useHostPaintedParts(annotation) {
  const hostId = annotation?.id ?? null;
  const baseMapId = annotation?.baseMapId ?? null;
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // data - paints

  const annotationTemplates = useAnnotationTemplates();
  const painted = usePaintedPartsQties({
    enabled: Boolean(hostId),
    keepHiddenTemplates: true,
    annotationTemplates,
  });
  const parts = useMemo(
    () =>
      hostId
        ? painted.parts.filter((p) => p.hostAnnotationId === hostId)
        : NO_IDS,
    [painted, hostId]
  );

  // data - brush annotations (ids first: the full resolve runs only when
  // the host has some)

  const brushIds =
    useLiveQuery(async () => {
      if (!hostId || !baseMapId) return NO_IDS;
      const rows = await db.annotations
        .where("baseMapId")
        .equals(baseMapId)
        .filter(
          (a) =>
            !a.deletedAt &&
            a.autoCreatedFrom === hostId &&
            a.autoGenKind === MESH_BRUSH_AUTO_GEN_KIND
        )
        .toArray();
      return rows.map((a) => a.id);
    }, [hostId, baseMapId]) ?? NO_IDS;
  const brushIdsKey = brushIds.join("|");

  const resolved = useAnnotationsV2({
    caller: "useHostPaintedParts",
    enabled: Boolean(projectId) && brushIds.length > 0,
    filterByBaseMapId: baseMapId,
    withQties: true,
    keepHiddenTemplates: true,
    ignoreSolo: true,
  });
  const brushAnnotations = useMemo(() => {
    if (!brushIds.length || !resolved?.length) return NO_IDS;
    const ids = new Set(brushIds);
    return resolved.filter((a) => ids.has(a.id));
  }, [resolved, brushIdsKey]);

  // helpers - groups

  const templateById = useMemo(() => {
    const byId = {};
    (annotationTemplates || []).forEach((t) => {
      if (t?.id) byId[t.id] = t;
    });
    return byId;
  }, [annotationTemplates]);

  return useMemo(() => {
    if (!parts.length && !brushAnnotations.length) return EMPTY;
    const byTemplateId = {};
    const getGroup = (templateId) => {
      let group = byTemplateId[templateId];
      if (!group) {
        group = {
          templateId,
          template: templateById[templateId] ?? null,
          parts: [],
          annotations: [],
          facesCount: 0,
          edgesCount: 0,
          linesCount: 0,
          polygonsCount: 0,
          surface: 0,
          length: 0,
        };
        byTemplateId[templateId] = group;
      }
      return group;
    };
    for (const part of parts) {
      const group = getGroup(part.annotationTemplateId ?? "__none__");
      group.parts.push(part);
      if (!part.isCounted) continue;
      if (part.partType === MESH_PAINT_PART_TYPES.FACE) group.facesCount += 1;
      if (part.partType === MESH_PAINT_PART_TYPES.EDGE) group.edgesCount += 1;
      if (part.qtiesEnabled) {
        if (Number.isFinite(part.surface)) group.surface += part.surface;
        if (Number.isFinite(part.length)) group.length += part.length;
      }
    }
    for (const a of brushAnnotations) {
      const group = getGroup(a.annotationTemplateId ?? "__none__");
      group.annotations.push(a);
      if (a.type === "POLYLINE") group.linesCount += 1;
      else group.polygonsCount += 1;
      const qties = a.qties;
      if (qties?.enabled === false) continue;
      if (a.type === "POLYLINE") {
        if (Number.isFinite(qties?.length)) group.length += qties.length;
      } else if (Number.isFinite(qties?.surface)) {
        group.surface += qties.surface;
      }
    }
    const groups = Object.values(byTemplateId).sort((g1, g2) =>
      (g1.template?.label ?? "").localeCompare(g2.template?.label ?? "")
    );
    return {
      groups,
      count: parts.length + brushAnnotations.length,
    };
  }, [parts, brushAnnotations, templateById]);
}
