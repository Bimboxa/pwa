import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { triggerRelsBusinessObjectAnnotationUpdate } from "../businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";

import db from "App/db/db";

import IconAnnotationLinkRemove from "Features/icons/IconAnnotationLinkRemove";
import useBusinessObjects from "../hooks/useBusinessObjects";
import useRelsBusinessObjectAnnotation from "../hooks/useRelsBusinessObjectAnnotation";
import useSetBusinessObjectAnnotationExclusions from "../hooks/useSetBusinessObjectAnnotationExclusions";

import { getBusinessObjectTypeKeyFromModuleKey } from "../utils/businessObjectModuleKeys";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import { getBusinessObjectAncestors } from "../utils/buildBusinessObjectsTree";
import { isTemplateLinked } from "../utils/linkedTemplateIds";
import { isAnnotationExcluded } from "../utils/excludedAnnotationIds";
import { isBusinessObjectClosed } from "../utils/getBusinessObjectStatus";

// ---------------------------------------------------------------------------
// SectionLinkedBusinessObjectsInToolbar — the business objects of the
// module's type the selected annotation(s) are linked to, listed under the
// « Associer à » band of ToolbarEditAnnotation(s): one row per object
// (label, ancestors path as secondary text, link kind) with an
// « annotation − » button at the right that unlinks (rel) or excludes /
// re-includes (link by template). Renders nothing without link.
// ---------------------------------------------------------------------------

export default function SectionLinkedBusinessObjectsInToolbar({ annotations }) {
  const dispatch = useDispatch();

  // data

  const moduleTypeKey = useSelector((s) =>
    getBusinessObjectTypeKeyFromModuleKey(s.viewers.selectedViewerKey)
  );
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const listingsById = useSelector((s) => s.listings.listingsById);

  const { value: scopeObjects } = useBusinessObjects({
    scopeId: moduleTypeKey ? selectedScopeId : null,
  });
  const setExclusions = useSetBusinessObjectAnnotationExclusions();

  // helpers — targets (mesh cells excluded: their parent is the linked one)

  const targets = useMemo(
    () => (annotations ?? []).filter((a) => a && !a.isMeshCell),
    [annotations]
  );
  const targetIds = useMemo(() => targets.map((a) => a.id), [targets]);

  const { value: rels } = useRelsBusinessObjectAnnotation({
    annotationIds: targetIds,
  });

  // objects of the module's type (their listing type), by id
  const typeObjects = useMemo(() => {
    if (!moduleTypeKey) return [];
    return (scopeObjects ?? []).filter(
      (o) =>
        getBusinessObjectTypeOfListing(listingsById?.[o.listingId]).key ===
        moduleTypeKey
    );
  }, [scopeObjects, listingsById, moduleTypeKey]);

  // one row per linked object: rels of the targets to it, targets fed by its
  // "Lien par modèle" (and the excluded ones among them)
  const rows = useMemo(() => {
    const byId = {};
    typeObjects.forEach((o) => {
      byId[o.id] = o;
    });
    const rowById = {};
    const rowOf = (businessObject) =>
      (rowById[businessObject.id] ??= {
        businessObject,
        rels: [],
        byTemplate: [],
        excluded: [],
      });
    (rels ?? []).forEach((rel) => {
      const businessObject = byId[rel.businessObjectId];
      if (businessObject) rowOf(businessObject).rels.push(rel);
    });
    typeObjects.forEach((businessObject) => {
      targets.forEach((annotation) => {
        if (!isTemplateLinked(businessObject, annotation.annotationTemplateId))
          return;
        const row = rowOf(businessObject);
        row.byTemplate.push(annotation);
        if (isAnnotationExcluded(businessObject, annotation.id))
          row.excluded.push(annotation);
      });
    });
    return Object.values(rowById).map((row) => {
      const fedIds = new Set(row.rels.map((r) => r.annotationId));
      const excludedIds = new Set(row.excluded.map((a) => a.id));
      row.byTemplate.forEach((a) => {
        if (!excludedIds.has(a.id)) fedIds.add(a.id);
      });
      const listingObjects = typeObjects.filter(
        (o) => o.listingId === row.businessObject.listingId
      );
      const pathLabel = getBusinessObjectAncestors(
        listingObjects,
        row.businessObject.id
      )
        .map((o) => o.label)
        .filter(Boolean)
        .join(" › ");
      return { ...row, fedCount: fedIds.size, pathLabel };
    });
  }, [rels, typeObjects, targets]);

  const type = useMemo(() => {
    const first = rows[0]?.businessObject;
    return getBusinessObjectTypeOfListing(
      first ? listingsById?.[first.listingId] : null
    );
  }, [rows, listingsById]);

  // strings

  const titleS = type.strings?.linkedObjects ?? "Objets liés";
  const byTemplateS = "lié par modèle";
  const excludedS = "exclue";

  function secondaryOf(row) {
    const parts = [];
    if (row.pathLabel) parts.push(row.pathLabel);
    const kinds = [];
    if (row.rels.length === 0 && row.byTemplate.length > 0)
      kinds.push(byTemplateS);
    if (
      row.excluded.length > 0 &&
      row.excluded.length === row.byTemplate.length
    )
      kinds.push(excludedS);
    if (targets.length > 1)
      kinds.push(`${row.fedCount}/${targets.length} liées`);
    if (kinds.length) parts.push(kinds.join(", "));
    return parts.join(" · ");
  }

  function removeTitleOf(row) {
    const label = row.businessObject.label;
    if (row.rels.length > 0) return `Délier de « ${label} »`;
    const allExcluded = row.excluded.length === row.byTemplate.length;
    return allExcluded
      ? `Réintégrer dans « ${label} »`
      : `Exclure de « ${label} » (lien par modèle)`;
  }

  // handlers

  async function handleRemove(row) {
    const { businessObject } = row;
    if (row.rels.length > 0) {
      try {
        // soft-delete middleware sets deletedAt
        await db.relsBusinessObjectAnnotation.bulkDelete(
          row.rels.map((r) => r.id)
        );
        dispatch(triggerRelsBusinessObjectAnnotationUpdate());
        const n = row.rels.length;
        dispatch(
          setToaster({
            message: `${n} annotation${n > 1 ? "s" : ""} déliée${
              n > 1 ? "s" : ""
            } de "${businessObject.label}"`,
          })
        );
      } catch (error) {
        console.error("[SectionLinkedBusinessObjectsInToolbar] unlink", error);
        dispatch(
          setToaster({ message: error?.message ?? `${error}`, isError: true })
        );
      }
      return;
    }
    if (row.byTemplate.length === 0) return;
    const allExcluded = row.excluded.length === row.byTemplate.length;
    await setExclusions({
      businessObject,
      annotationIds: row.byTemplate.map((a) => a.id),
      excluded: !allExcluded,
    });
  }

  // render

  if (!moduleTypeKey || rows.length === 0) return null;

  return (
    <Box
      sx={{
        px: 1.25,
        pt: 0.75,
        pb: 0.5,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {titleS}
      </Typography>
      {rows.map((row) => {
        const { businessObject } = row;
        const isClosed = isBusinessObjectClosed(businessObject);
        const isOut =
          row.rels.length === 0 &&
          row.byTemplate.length > 0 &&
          row.excluded.length === row.byTemplate.length;
        const secondary = secondaryOf(row);
        return (
          <Box
            key={businessObject.id}
            sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.25 }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  ...((isClosed || isOut) && {
                    textDecoration: "line-through",
                    color: "text.disabled",
                  }),
                }}
                title={businessObject.label}
              >
                {businessObject.label}
              </Typography>
              {secondary && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ display: "block", lineHeight: 1.2 }}
                  title={secondary}
                >
                  {secondary}
                </Typography>
              )}
            </Box>
            <Tooltip title={removeTitleOf(row)} placement="top" arrow>
              <IconButton
                size="small"
                onClick={() => handleRemove(row)}
                sx={{ color: isOut ? "secondary.main" : "panel.textMuted" }}
              >
                <IconAnnotationLinkRemove sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
}
