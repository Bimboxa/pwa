import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerRelsBusinessObjectAnnotationUpdate } from "../businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddLink, LinkOff } from "@mui/icons-material";

import db from "App/db/db";

import useRelsBusinessObjectAnnotation from "../hooks/useRelsBusinessObjectAnnotation";
import useUpdateBusinessObject from "../hooks/useUpdateBusinessObject";
import useLinkAnnotationsToBusinessObject from "../hooks/useLinkAnnotationsToBusinessObject";
import useSetBusinessObjectAnnotationExclusions from "../hooks/useSetBusinessObjectAnnotationExclusions";

import { isBusinessObjectsModuleKey } from "../utils/businessObjectModuleKeys";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import getBusinessObjectQtyKind, {
  getBusinessObjectUnitText,
} from "../utils/getBusinessObjectQtyKind";
import { isTemplateLinked } from "../utils/linkedTemplateIds";
import { isAnnotationExcluded } from "../utils/excludedAnnotationIds";
import {
  getDefaultQtyFormula,
  getQtyFormulaKey,
  getQtyFormulasByTemplateId,
  normalizeQtyFormula,
} from "../utils/qtyFormula";
import setQtyFormulaForTemplate from "../utils/setQtyFormulaForTemplate";

// Quantity kind options of the toggle: the per-template formula of the
// active object (U = count, L = length, S = surface — see qtyFormula.js).
const KINDS = [
  { key: "U", label: "Unité (U) — nombre d'annotations" },
  { key: "L", label: "Longueur (L)" },
  { key: "S", label: "Surface (S)" },
];
// A unit-less object gets its unit from the first toggle choice (the default
// formula then follows the unit).
const UNIT_BY_KIND = { U: "u", L: "ml", S: "m²" };

const TOGGLE_SX = {
  "& .MuiToggleButton-root": {
    px: 1,
    py: 0.25,
    fontSize: "0.75rem",
    lineHeight: 1.4,
    textTransform: "none",
  },
};

// Band shown under the actions row of ToolbarEditAnnotation(s) in the
// business-objects modules while an object is ACTIVE (the tree row clicked
// last — the map selection replaces the BUSINESS_OBJECT selection item, the
// active id survives it): « Associer à « objet » » + the U / L / S toggle of
// the object's formula for the selection's template(s) + a « + » (link the
// selection by annotation / unlink it) + a « − » (exclude the selection from
// the object's "Lien par modèle" / re-include it — offered only when a
// selected annotation's template is linked by template).
export default function SectionBusinessObjectBandInToolbar({ annotations }) {
  const dispatch = useDispatch();

  // data

  const isBusinessObjectsModule = useSelector((s) =>
    isBusinessObjectsModuleKey(s.viewers.selectedViewerKey)
  );
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects.activeBusinessObjectId
  );
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects.businessObjectsUpdatedAt
  );

  const businessObject = useLiveQuery(async () => {
    if (!isBusinessObjectsModule || !activeBusinessObjectId) return null;
    const o = await db.businessObjects.get(activeBusinessObjectId);
    return o && !o.deletedAt ? o : null;
  }, [
    isBusinessObjectsModule,
    activeBusinessObjectId,
    businessObjectsUpdatedAt,
  ]);

  // the object's listing type: only the types with quantities link
  // annotations this way (listingsById = Dexie mirror kept by dexieSyncService)
  const listing = useSelector((s) =>
    businessObject?.listingId
      ? (s.listings.listingsById?.[businessObject.listingId] ?? null)
      : null
  );
  const hasQuantities = Boolean(
    getBusinessObjectTypeOfListing(listing).features?.quantities
  );

  const updateBusinessObject = useUpdateBusinessObject();
  const linkAnnotations = useLinkAnnotationsToBusinessObject();
  const setExclusions = useSetBusinessObjectAnnotationExclusions();

  // helpers — targets (mesh cells excluded: their parent is the one to link)

  const targets = useMemo(
    () => (annotations ?? []).filter((a) => a && !a.isMeshCell),
    [annotations]
  );
  const targetIds = useMemo(() => targets.map((a) => a.id), [targets]);

  const { value: allRels } = useRelsBusinessObjectAnnotation({
    annotationIds: targetIds,
  });

  // per target: rel to the active object, template link, exclusion
  const entries = useMemo(() => {
    if (!businessObject) return [];
    const relByAnnotationId = {};
    (allRels ?? []).forEach((rel) => {
      if (rel.businessObjectId === businessObject.id)
        relByAnnotationId[rel.annotationId] = rel;
    });
    return targets.map((annotation) => {
      const rel = relByAnnotationId[annotation.id] ?? null;
      const byTemplate = isTemplateLinked(
        businessObject,
        annotation.annotationTemplateId
      );
      const excluded =
        byTemplate && isAnnotationExcluded(businessObject, annotation.id);
      return {
        annotation,
        rel,
        byTemplate,
        excluded,
        fed: Boolean(rel) || (byTemplate && !excluded),
      };
    });
  }, [businessObject, allRels, targets]);

  const toLink = entries.filter((e) => !e.fed);
  const withRel = entries.filter((e) => e.rel);
  const applicable = entries.filter((e) => e.byTemplate);
  const allApplicableExcluded =
    applicable.length > 0 && applicable.every((e) => e.excluded);

  // helpers — U / L / S = the object's formula for the selection's templates
  // (one value when every template agrees on a plain U / L / S, else none)

  const templateIds = useMemo(
    () => [...new Set(targets.map((a) => a.annotationTemplateId ?? null))],
    [targets]
  );
  const defaultFormula = getDefaultQtyFormula(businessObject?.unit);
  const kindValue = useMemo(() => {
    if (!businessObject || templateIds.length === 0) return null;
    const formulasByKey = getQtyFormulasByTemplateId(businessObject);
    const values = templateIds.map((templateId) =>
      normalizeQtyFormula(
        formulasByKey?.[getQtyFormulaKey(templateId)]?.formula ??
          defaultFormula ??
          ""
      )
    );
    const first = values[0];
    if (!values.every((v) => v === first)) return null;
    return KINDS.some((k) => k.key === first) ? first : null;
  }, [businessObject, templateIds, defaultFormula]);

  // strings

  const unitText = getBusinessObjectUnitText(businessObject?.unit);
  const titleS = `Associer à « ${businessObject?.label ?? ""} »${
    unitText ? ` (${unitText})` : ""
  }`;
  const label = businessObject?.label ?? "";
  const plusS =
    toLink.length > 0
      ? `Lier à « ${label} »`
      : withRel.length > 0
        ? `Délier de « ${label} »`
        : "Déjà comptée(s) par le lien par modèle";
  const minusS = allApplicableExcluded
    ? `Réintégrer dans « ${label} »`
    : `Exclure de « ${label} » (lien par modèle)`;
  const kindS =
    kindValue === null && templateIds.length > 0
      ? "Formule personnalisée ou mixte — choisir U / L / S la remplace"
      : "Quantité de l'annotation comptée dans l'objet";

  const statusS = (() => {
    if (entries.length === 0) return "";
    if (entries.length === 1) {
      const e = entries[0];
      if (e.rel) return "Liée";
      if (e.excluded) return "Exclue";
      if (e.byTemplate) return "Liée par modèle";
      return "Non liée";
    }
    const linked = entries.filter((e) => e.fed).length;
    const excluded = entries.filter((e) => e.excluded).length;
    return (
      `${linked}/${entries.length} liées` +
      (excluded > 0 ? ` · ${excluded} exclue${excluded > 1 ? "s" : ""}` : "")
    );
  })();

  // handlers

  async function handleKindChange(_e, kind) {
    if (!kind || !businessObject) return;
    // unit-less object: the unit drives the default formula
    if (getBusinessObjectQtyKind(businessObject.unit) === null) {
      await updateBusinessObject(businessObject.id, {
        unit: UNIT_BY_KIND[kind],
      });
      return;
    }
    let qtyFormulas = businessObject.qtyFormulas ?? [];
    templateIds.forEach((templateId) => {
      qtyFormulas = setQtyFormulaForTemplate(
        qtyFormulas,
        templateId,
        kind,
        defaultFormula
      );
    });
    await updateBusinessObject(businessObject.id, { qtyFormulas });
  }

  async function handlePlus() {
    if (!businessObject) return;
    if (toLink.length > 0) {
      await linkAnnotations({
        businessObject,
        annotationIds: toLink.map((e) => e.annotation.id),
      });
      return;
    }
    if (withRel.length === 0) return;
    try {
      // soft-delete middleware sets deletedAt
      await db.relsBusinessObjectAnnotation.bulkDelete(
        withRel.map((e) => e.rel.id)
      );
      dispatch(triggerRelsBusinessObjectAnnotationUpdate());
      const n = withRel.length;
      dispatch(
        setToaster({
          message: `${n} annotation${n > 1 ? "s" : ""} déliée${
            n > 1 ? "s" : ""
          } de "${businessObject.label}"`,
        })
      );
    } catch (error) {
      console.error("[SectionBusinessObjectBandInToolbar] unlink", error);
      dispatch(
        setToaster({ message: error?.message ?? `${error}`, isError: true })
      );
    }
  }

  async function handleMinus() {
    if (!businessObject || applicable.length === 0) return;
    await setExclusions({
      businessObject,
      annotationIds: applicable.map((e) => e.annotation.id),
      excluded: !allApplicableExcluded,
    });
  }

  // render

  if (!isBusinessObjectsModule || !businessObject || !hasQuantities)
    return null;
  if (targets.length === 0) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 0.5,
        px: 1.25,
        py: 0.75,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        noWrap
        sx={{ flex: 1, minWidth: 0, mr: 0.5 }}
        title={titleS}
      >
        {titleS}
      </Typography>

      <Tooltip title={kindS} placement="top" arrow>
        <ToggleButtonGroup
          value={kindValue}
          exclusive
          size="small"
          onChange={handleKindChange}
          sx={TOGGLE_SX}
        >
          {KINDS.map((kind) => (
            <ToggleButton key={kind.key} value={kind.key} title={kind.label}>
              {kind.key}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Tooltip>

      <Tooltip title={plusS} placement="top" arrow>
        <span>
          <IconButton
            size="small"
            onClick={handlePlus}
            disabled={toLink.length === 0 && withRel.length === 0}
            color={
              toLink.length === 0 && withRel.length > 0 ? "primary" : "default"
            }
          >
            <AddLink sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>

      {applicable.length > 0 && (
        <Tooltip title={minusS} placement="top" arrow>
          <IconButton
            size="small"
            onClick={handleMinus}
            color={allApplicableExcluded ? "primary" : "default"}
          >
            <LinkOff sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}

      {statusS && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexBasis: "100%" }}
        >
          {statusS}
        </Typography>
      )}
    </Box>
  );
}
