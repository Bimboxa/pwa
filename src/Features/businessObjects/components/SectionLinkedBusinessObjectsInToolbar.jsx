import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { triggerRelsBusinessObjectAnnotationUpdate } from "../businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";

import db from "App/db/db";

import IconAnnotationLinkAdd from "Features/icons/IconAnnotationLinkAdd";
import IconAnnotationLinkRemove from "Features/icons/IconAnnotationLinkRemove";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useBusinessObjects from "../hooks/useBusinessObjects";
import useRelsBusinessObjectAnnotation from "../hooks/useRelsBusinessObjectAnnotation";
import useLinkAnnotationsToBusinessObject from "../hooks/useLinkAnnotationsToBusinessObject";
import useSetBusinessObjectAnnotationExclusions from "../hooks/useSetBusinessObjectAnnotationExclusions";

import { getBusinessObjectTypeKeyFromModuleKey } from "../utils/businessObjectModuleKeys";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import { getBusinessObjectAncestors } from "../utils/buildBusinessObjectsTree";
import { isTemplateLinked } from "../utils/linkedTemplateIds";
import { isAnnotationExcluded } from "../utils/excludedAnnotationIds";
import { isBusinessObjectClosed } from "../utils/getBusinessObjectStatus";
import { getQtyFormulasByTemplateId } from "../utils/qtyFormula";
import accumulateAnnotationQties, {
  createEmptyQties,
} from "../utils/accumulateAnnotationQties";
import getBusinessObjectQtyLabel from "../utils/getBusinessObjectQtyLabel";
import selectedBusinessObjectBgcolor from "../utils/selectedBusinessObjectBgcolor";

// ---------------------------------------------------------------------------
// SectionLinkedBusinessObjectsInToolbar — business-objects modules, at the
// bottom of ToolbarEditAnnotation(s): one row per object of the module's
// type the selected annotation(s) feed (label, ancestors path, the quantity
// they represent in the object's unit — the object's formula for their
// template, else the unit's default rule —, « annotation − » to unlink the
// rel or exclude / re-include a link by template), then the module's ACTIVE
// object (the tree row clicked last) highlighted at the bottom when the
// selection does not feed it yet: the quantity it would add and an
// « annotation + » that links by annotation. Renders nothing without rows.
// ---------------------------------------------------------------------------

const QTY_SX = {
  fontFamily: "monospace",
  fontWeight: 500,
  color: "warning.main",
  flexShrink: 0,
};

export default function SectionLinkedBusinessObjectsInToolbar({ annotations }) {
  const dispatch = useDispatch();

  // data

  const moduleTypeKey = useSelector((s) =>
    getBusinessObjectTypeKeyFromModuleKey(s.viewers.selectedViewerKey)
  );
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects.activeBusinessObjectId
  );
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const listingsById = useSelector((s) => s.listings.listingsById);

  const { value: scopeObjects } = useBusinessObjects({
    scopeId: moduleTypeKey ? selectedScopeId : null,
  });
  // the selection with its quantities (the toolbar's annotations may be
  // resolved without them)
  const annotationsWithQties = useAnnotationsV2({
    caller: "SectionLinkedBusinessObjectsInToolbar",
    withQties: true,
    ignoreSolo: true,
    keepHiddenTemplates: true,
    filterBySelectedScope: true,
  });
  const linkAnnotations = useLinkAnnotationsToBusinessObject();
  const setExclusions = useSetBusinessObjectAnnotationExclusions();

  // helpers — targets (mesh cells excluded: their parent is the linked one)

  const targets = useMemo(() => {
    const byId = {};
    (annotationsWithQties ?? []).forEach((a) => {
      byId[a.id] = a;
    });
    return (annotations ?? [])
      .filter((a) => a && !a.isMeshCell)
      .map((a) => byId[a.id] ?? a);
  }, [annotations, annotationsWithQties]);
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

  const type = useMemo(() => {
    const first = typeObjects[0];
    return getBusinessObjectTypeOfListing(
      first ? listingsById?.[first.listingId] : null
    );
  }, [typeObjects, listingsById]);
  const hasQuantities = Boolean(type.features?.quantities);

  function pathLabelOf(businessObject) {
    const listingObjects = typeObjects.filter(
      (o) => o.listingId === businessObject.listingId
    );
    return getBusinessObjectAncestors(listingObjects, businessObject.id)
      .map((o) => o.label)
      .filter(Boolean)
      .join(" › ");
  }

  // quantity of some annotations in an object's unit: the object's formula
  // for their template when defined, else the unit's default rule
  function qtyLabelOf(businessObject, items) {
    if (!hasQuantities || items.length === 0) return null;
    const formulas = getQtyFormulasByTemplateId(businessObject);
    const stats = createEmptyQties();
    items.forEach((a) => accumulateAnnotationQties(stats, a, formulas));
    return getBusinessObjectQtyLabel(businessObject.unit, stats);
  }

  // one row per linked object: rels of the targets to it, targets fed by its
  // "Lien par modèle" (and the excluded ones among them)
  const rows = useMemo(() => {
    const byId = {};
    typeObjects.forEach((o) => {
      byId[o.id] = o;
    });
    const targetById = {};
    targets.forEach((a) => {
      targetById[a.id] = a;
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
      if (businessObject && targetById[rel.annotationId])
        rowOf(businessObject).rels.push(rel);
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
      const fed = [...fedIds].map((id) => targetById[id]).filter(Boolean);
      return {
        ...row,
        fed,
        isOut:
          row.rels.length === 0 &&
          row.byTemplate.length > 0 &&
          row.excluded.length === row.byTemplate.length,
        pathLabel: pathLabelOf(row.businessObject),
        qtyLabel: qtyLabelOf(row.businessObject, fed),
      };
    });
  }, [rels, typeObjects, targets, hasQuantities]);

  // the module's active object, offered at the bottom while the selection
  // does not feed it entirely (types with quantities only)
  const activeRow = useMemo(() => {
    if (!hasQuantities || !activeBusinessObjectId) return null;
    const businessObject = typeObjects.find(
      (o) => o.id === activeBusinessObjectId
    );
    if (!businessObject) return null;
    const linked = rows.find((r) => r.businessObject.id === businessObject.id);
    const fedIds = new Set((linked?.fed ?? []).map((a) => a.id));
    const toLink = targets.filter((a) => !fedIds.has(a.id));
    if (toLink.length === 0) return null;
    return {
      businessObject,
      toLink,
      pathLabel: pathLabelOf(businessObject),
      qtyLabel: qtyLabelOf(businessObject, toLink),
    };
  }, [hasQuantities, activeBusinessObjectId, typeObjects, rows, targets]);

  // strings

  const byTemplateS = "lié par modèle";
  const excludedS = "exclue";

  function secondaryOf(row) {
    const parts = [];
    if (row.pathLabel) parts.push(row.pathLabel);
    const kinds = [];
    if (row.rels.length === 0 && row.byTemplate.length > 0)
      kinds.push(byTemplateS);
    if (row.isOut) kinds.push(excludedS);
    if (targets.length > 1)
      kinds.push(`${row.fed.length}/${targets.length} liées`);
    if (kinds.length) parts.push(kinds.join(", "));
    return parts.join(" · ");
  }

  function removeTitleOf(row) {
    const label = row.businessObject.label;
    if (row.rels.length > 0) return `Délier de « ${label} »`;
    return row.isOut
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
    await setExclusions({
      businessObject,
      annotationIds: row.byTemplate.map((a) => a.id),
      excluded: !row.isOut,
    });
  }

  async function handleLink() {
    if (!activeRow) return;
    await linkAnnotations({
      businessObject: activeRow.businessObject,
      annotationIds: activeRow.toLink.map((a) => a.id),
    });
  }

  // render

  if (!moduleTypeKey || (rows.length === 0 && !activeRow)) return null;

  const rowSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    px: 1.25,
    py: 0.75,
  };

  function renderTexts(businessObject, secondary, strike) {
    return (
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{
            ...(strike && {
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
    );
  }

  return (
    <Box
      sx={{
        borderTop: "1px solid",
        borderColor: "divider",
        // a divider between the rows
        "& > * + *": { borderTop: "1px solid", borderColor: "divider" },
      }}
    >
      {rows.map((row) => {
        const { businessObject } = row;
        const isActive = businessObject.id === activeBusinessObjectId;
        return (
          <Box
            key={businessObject.id}
            sx={(theme) => ({
              ...rowSx,
              ...(isActive && {
                bgcolor: selectedBusinessObjectBgcolor(theme),
              }),
            })}
          >
            {renderTexts(
              businessObject,
              secondaryOf(row),
              isBusinessObjectClosed(businessObject) || row.isOut
            )}
            {row.qtyLabel && !row.isOut && (
              <Typography variant="caption" noWrap sx={QTY_SX}>
                {row.qtyLabel}
              </Typography>
            )}
            <Tooltip title={removeTitleOf(row)} placement="top" arrow>
              <IconButton
                size="small"
                onClick={() => handleRemove(row)}
                sx={{
                  color: row.isOut ? "secondary.main" : "panel.textMuted",
                }}
              >
                <IconAnnotationLinkRemove sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}

      {activeRow && (
        <Box
          sx={(theme) => ({
            ...rowSx,
            bgcolor: selectedBusinessObjectBgcolor(theme),
          })}
        >
          {renderTexts(activeRow.businessObject, activeRow.pathLabel, false)}
          {activeRow.qtyLabel && (
            <Typography variant="caption" noWrap sx={QTY_SX}>
              {`+ ${activeRow.qtyLabel}`}
            </Typography>
          )}
          <Tooltip
            title={`Lier à « ${activeRow.businessObject.label} »`}
            placement="top"
            arrow
          >
            <IconButton
              size="small"
              onClick={handleLink}
              sx={{ color: "secondary.main" }}
            >
              <IconAnnotationLinkAdd sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}
