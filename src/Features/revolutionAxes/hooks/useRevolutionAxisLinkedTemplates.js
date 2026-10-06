import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";
import { isRevolutionHelperType } from "Features/annotations/constants/drawingShapeConfig";

import getRevolutionAxisIdOfAnnotation from "../utils/getRevolutionAxisIdOfAnnotation";

const EMPTY = [];
const NO_TEMPLATE_KEY = "__none__";

// Annotations revolved around a plan axis (profiles / circles carrying
// `shape3D: {key: "REVOLUTION", axisAnnotationId}`), grouped by annotation
// template. Same membership rule as the `linkedCount` of
// useRevolutionAxesOfBaseMap (the "N u" of the axes section), so the toolbar
// section totals match it.
//
// Returns [{ key, template, label, count }] sorted by label; template-less
// rows end up in one "Sans modèle" group.
export default function useRevolutionAxisLinkedTemplates(axisId) {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const annotationTemplatesUpdatedAt = useSelector(
    (s) => s.annotations.annotationTemplatesUpdatedAt
  );

  const groups = useLiveQuery(async () => {
    if (!projectId || !axisId) return EMPTY;
    const rows = (
      await db.annotations.where("projectId").equals(projectId).toArray()
    ).filter(
      (a) =>
        !a.deletedAt &&
        !isRevolutionHelperType(a.type) &&
        getRevolutionAxisIdOfAnnotation(a) === axisId
    );
    if (rows.length === 0) return EMPTY;

    const countByKey = new Map();
    for (const a of rows) {
      const key = a.annotationTemplateId ?? NO_TEMPLATE_KEY;
      countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
    }
    const templateIds = [...countByKey.keys()].filter(
      (k) => k !== NO_TEMPLATE_KEY
    );
    const templates = templateIds.length
      ? await db.annotationTemplates.bulkGet(templateIds)
      : [];
    const templateById = new Map(
      templates.filter(Boolean).map((t) => [t.id, t])
    );

    return [...countByKey.entries()]
      .map(([key, count]) => {
        const template = templateById.get(key) ?? null;
        return {
          key,
          template,
          label:
            key === NO_TEMPLATE_KEY ? "Sans modèle" : (template?.label ?? "-"),
          count,
        };
      })
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true })
      );
  }, [projectId, axisId, annotationsUpdatedAt, annotationTemplatesUpdatedAt]);

  return groups ?? EMPTY;
}
