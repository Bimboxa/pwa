import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  setLinkingBusinessObjectId,
  triggerRelsBusinessObjectAnnotationUpdate,
} from "../businessObjectsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setNotesAppObjectPropertiesTab } from "Features/notesApp/notesAppSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddLink,
  LinkOff,
  ArrowBack as Back,
  CloudDownload,
  LocationOff,
} from "@mui/icons-material";

import db from "App/db/db";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useRelsBusinessObjectAnnotation from "../hooks/useRelsBusinessObjectAnnotation";
import useUpdateBusinessObject from "../hooks/useUpdateBusinessObject";
import useBusinessObjectHoursBudget from "../hooks/useBusinessObjectHoursBudget";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import unsetMainAnnotationService from "../services/unsetMainAnnotationService";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import FieldColorV2 from "Features/form/components/FieldColorV2";
import FieldHoursRatioCompact from "./FieldHoursRatioCompact";
import FieldTaskGlobalLayer from "./FieldTaskGlobalLayer";
import SectionNotesAppObjectNotes from "Features/notesApp/components/SectionNotesAppObjectNotes";
import SectionBusinessObjectFiche from "./SectionBusinessObjectFiche";
import SectionBusinessObjectDocuments from "./SectionBusinessObjectDocuments";
import SectionBusinessObjectLinkedAnnotations from "./SectionBusinessObjectLinkedAnnotations";
import SectionBusinessObjectQuantities from "./SectionBusinessObjectQuantities";
import ButtonAssignBusinessObjectAnnotations from "./ButtonAssignBusinessObjectAnnotations";
import PanelBusinessObjectTemplateAnnotations from "./PanelBusinessObjectTemplateAnnotations";
import useNotesAppConfig from "Features/notesApp/hooks/useNotesAppConfig";
import useNotesAppListingConfig from "Features/notesApp/hooks/useNotesAppListingConfig";
import useNotesAppScopeLink from "Features/notesApp/hooks/useNotesAppScopeLink";
import useSyncNotesAppBusinessObject from "Features/notesApp/hooks/useSyncNotesAppBusinessObject";
import buildBusinessObjectDebugPayload from "../utils/buildBusinessObjectDebugPayload";
import getAnnotationMainQtyLabel from "Features/annotations/utils/getAnnotationMainQtyLabel";
import { getBusinessObjectUnitText } from "../utils/getBusinessObjectQtyKind";
import formatBusinessObjectNumber from "../utils/formatBusinessObjectNumber";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import selectSelectedBusinessObjectId from "../utils/selectSelectedBusinessObjectId";
import {
  BUSINESS_OBJECT_STATUS,
  isBusinessObjectClosed,
} from "../utils/getBusinessObjectStatus";
import getHoursRatioUnit from "../utils/getHoursRatioUnit";
import {
  formatHours,
  getHoursRatioFromDisplayed,
  getHoursRatioInputText,
  isValidHoursRatio,
  parseHoursRatioInput,
} from "../utils/hoursRatioConversions";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import { getQtyFormulaKey } from "../utils/qtyFormula";

import { DEFAULT_HOURS_RATIO_MODE } from "../constants/businessObjectEntityModel";

function getRefQtyText(refQty) {
  return Number.isFinite(refQty) ? formatBusinessObjectNumber(refQty, 3) : "";
}

function blurOnEnter(e) {
  if (e.key === "Enter") e.target.blur();
}

// Right-panel properties of the business object selected in the Ouvrages
// drawer (selection item {type: "BUSINESS_OBJECT"}), in tabs.
// "Infos": editable props (code, label, description, free-text unit,
// reference quantity, color — the field set follows the listing type
// features), the linked documents and the object's MAIN annotations (one per
// base map, "Localisation" section, drawn from the Dessin popper).
// "Quantités": the picking-mode toggle, the quantity summary (computed vs
// reference, gap) and one card per linked annotation template with its
// editable quantity formula (SectionBusinessObjectQuantities); a card opens
// the template's linked annotations in a sub-panel
// (PanelBusinessObjectTemplateAnnotations).
// Tasks (type feature hoursBudget) replace the unit with the hours ratio
// field (Ratio / Cadence), add the rolled-up hours budget band and have no
// color (feature color false).
// Issues (type features status, no quantities / code / titleRows): label +
// description, an open / closed checkbox in the header, no "Quantités" tab —
// the picking-mode toggle and the linked annotations list move to "Infos"
// (SectionBusinessObjectLinkedAnnotations).
export default function PanelBusinessObjectProperties() {
  const dispatch = useDispatch();

  // data — selected object

  const businessObjectId = useSelector(selectSelectedBusinessObjectId);
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects.businessObjectsUpdatedAt
  );
  const linkingBusinessObjectId = useSelector(
    (s) => s.businessObjects.linkingBusinessObjectId
  );

  const businessObject = useLiveQuery(async () => {
    if (!businessObjectId) return null;
    const o = await db.businessObjects.get(businessObjectId);
    return o && !o.deletedAt ? o : null;
  }, [businessObjectId, businessObjectsUpdatedAt]);

  // data — listing type (wording + hours budget feature)

  const listing = useLiveQuery(
    () =>
      businessObject?.listingId
        ? db.listings.get(businessObject.listingId)
        : null,
    [businessObject?.listingId]
  );
  const type = getBusinessObjectTypeOfListing(listing);
  const hasHoursBudget = Boolean(type.features?.hoursBudget);
  const hasColor = Boolean(type.features?.color);
  const hasQuantities = Boolean(type.features?.quantities);
  const hasCode = Boolean(type.features?.code);
  const hasTitleRows = Boolean(type.features?.titleRows);
  const hasStatus = Boolean(type.features?.status);

  // hours budget of the whole listing (own + descendants per task) — null
  // listingId short-circuits the queries for non-task listings
  const hoursBudget = useBusinessObjectHoursBudget({
    listingId: hasHoursBudget ? businessObject?.listingId : null,
  });

  // data — linked annotations

  const { value: rels } = useRelsBusinessObjectAnnotation({ businessObjectId });

  const annotations = useAnnotationsV2({
    caller: "PanelBusinessObjectProperties",
    withQties: true,
    ignoreSolo: true,
    keepHiddenTemplates: true,
    filterBySelectedScope: true,
  });

  const annotationTemplates = useAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();
  const updateBusinessObject = useUpdateBusinessObject();

  const { value: baseMaps } = useBaseMaps();
  const baseMapNameById = useMemo(() => {
    const byId = {};
    (baseMaps ?? []).forEach((b) => {
      byId[b.id] = b.name ?? b.label ?? "";
    });
    return byId;
  }, [baseMaps]);

  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  // state — text fields edited locally, committed on blur

  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  // free text, "" = unit-less
  const [unit, setUnit] = useState("");
  // reference quantity text ("" = none)
  const [refQtyText, setRefQtyText] = useState("");
  // ratio field text in the task's persisted mode ("" = no ratio)
  const [hoursRatioText, setHoursRatioText] = useState("");

  const hoursRatioMode =
    businessObject?.hoursRatioMode ?? DEFAULT_HOURS_RATIO_MODE;

  useEffect(() => {
    setLabel(businessObject?.label ?? "");
    setCode(businessObject?.code ?? "");
    setDescription(businessObject?.description ?? "");
    setUnit(getBusinessObjectUnitText(businessObject?.unit));
    setRefQtyText(getRefQtyText(businessObject?.refQty));
    setHoursRatioText(
      getHoursRatioInputText(businessObject?.hoursRatio, hoursRatioMode)
    );
  }, [
    businessObject?.id,
    businessObject?.label,
    businessObject?.code,
    businessObject?.description,
    businessObject?.unit,
    businessObject?.refQty,
    businessObject?.hoursRatio,
    hoursRatioMode,
  ]);

  // state — tabs: "Infos" (PROPS) and "Quantités" (QTY) for every object;
  // the "Fiche" tab edits the listing-model fields (Krnet "Modèle de fiche"
  // of the listing, when it has one); the "Notes" tab shows the Krnet notes
  // feed of an imported object (photos, comments, events... under
  // businessObject.notesAppNotes). The selection lives in Redux so browsing
  // from object to object keeps the tab; an object without the tab falls
  // back to "PROPS".

  const tab = useSelector((s) => s.notesApp.objectPropertiesTab);
  const notesAppConfig = useNotesAppConfig();
  const notesAppEnabled = notesAppConfig?.enabled === true;
  const notesAppName = notesAppConfig?.name ?? "Krnet";
  const listingConfig = useNotesAppListingConfig(listing);
  const hasFiche = notesAppEnabled && listingConfig.fields.length > 0;
  const isNotesAppObject = businessObject?.remoteSource === "notesApp";
  const notesCount = businessObject?.notesAppNotes?.length ?? 0;

  // data — per-object pull from Krnet (header icon button): the
  // object must be linked to a Krnet object and the scope to a Krnet
  // project. Pull only: nothing is sent to Krnet.
  const { link: notesAppLink } = useNotesAppScopeLink();
  const { syncBusinessObject, syncing: pulling } =
    useSyncNotesAppBusinessObject();
  const canPull =
    isNotesAppObject &&
    Boolean(businessObject?.idMaster) &&
    Boolean(notesAppLink?.projectId);

  // strings

  const pullTitleS = `Récupérer les données de cet objet depuis ${notesAppName} (aucun envoi vers ${notesAppName})`;
  const debugTitleS =
    "Copier les données locales de l'objet (JSON) dans le presse-papier";
  const effectiveTab =
    (tab === "QTY" && hasQuantities) ||
    (tab === "FICHE" && hasFiche) ||
    (tab === "NOTES" && isNotesAppObject)
      ? tab
      : "PROPS";

  // state — annotation template whose linked annotations are shown in the
  // sub-panel of the "Quantités" tab (getQtyFormulaKey key, "" = annotations
  // without template); null = quantities recap

  const [openedTemplateKey, setOpenedTemplateKey] = useState(null);

  useEffect(() => {
    setOpenedTemplateKey(null);
  }, [businessObjectId, effectiveTab]);

  // helpers — linked annotations + rolled-up quantities

  const linkedRows = useMemo(() => {
    const relByAnnotationId = {};
    (rels ?? []).forEach((r) => {
      relByAnnotationId[r.annotationId] = r;
    });
    return (annotations ?? [])
      .filter((a) => relByAnnotationId[a.id])
      .map((a) => ({ annotation: a, rel: relByAnnotationId[a.id] }));
  }, [rels, annotations]);

  // main annotations ("Localisation"); the "Annotations liées" recap and
  // the quantity rollup count every linked annotation, main ones included.
  const mainRows = useMemo(
    () => linkedRows.filter(({ rel }) => rel.isMain),
    [linkedRows]
  );

  const openedTemplateRows = useMemo(
    () =>
      openedTemplateKey === null
        ? []
        : linkedRows.filter(
            ({ annotation }) =>
              getQtyFormulaKey(annotation.annotationTemplateId) ===
              openedTemplateKey
          ),
    [linkedRows, openedTemplateKey]
  );

  const isLinking = linkingBusinessObjectId === businessObject?.id;

  // helpers — hours budget of the selected task

  const ownHours = hoursBudget.ownById[businessObject?.id] ?? null;
  const totalHours = hoursBudget.totalById[businessObject?.id] ?? null;
  const hasChildren = hoursBudget.businessObjects.some(
    (o) => o.parentId === businessObject?.id
  );
  // unit the task's ratio (and so its rolled-up quantity) is read in
  const ratioUnit = getHoursRatioUnit(businessObject);

  // handlers

  function handleLabelBlur() {
    if (!businessObject) return;
    if (label && label !== businessObject.label)
      updateBusinessObject(businessObject.id, { label });
  }

  function handleDescriptionBlur() {
    if (!businessObject) return;
    if (description !== (businessObject.description ?? ""))
      updateBusinessObject(businessObject.id, { description });
  }

  function handleCodeBlur() {
    if (!businessObject) return;
    const next = code.trim();
    if (next !== (businessObject.code ?? ""))
      updateBusinessObject(businessObject.id, { code: next });
    else setCode(next);
  }

  // "" = unit-less (stored as null). Compared as display texts, so a legacy
  // "S" row shown as "m²" is not rewritten by a plain blur.
  function handleUnitBlur() {
    if (!businessObject) return;
    const next = unit.trim();
    if (next !== getBusinessObjectUnitText(businessObject.unit))
      updateBusinessObject(businessObject.id, { unit: next || null });
    else setUnit(next);
  }

  function handleRefQtyBlur() {
    if (!businessObject) return;
    // untouched text: the stored value (maybe more precise) is kept
    if (refQtyText === getRefQtyText(businessObject.refQty)) return;
    const refQty = parseHoursRatioInput(refQtyText.replace(/\s/g, ""));
    if (refQty !== (businessObject.refQty ?? null))
      updateBusinessObject(businessObject.id, { refQty });
    else setRefQtyText(getRefQtyText(refQty));
  }

  function handleTitleChange(e) {
    updateBusinessObject(businessObject.id, { isTitle: e.target.checked });
  }

  function handleStatusChange(e) {
    updateBusinessObject(businessObject.id, {
      status: e.target.checked
        ? BUSINESS_OBJECT_STATUS.CLOSED
        : BUSINESS_OBJECT_STATUS.OPEN,
    });
  }

  function handleGlobalLayerChange(globalLayerId) {
    updateBusinessObject(businessObject.id, { globalLayerId });
  }

  // hex string from the shared color picker
  function handleColorChange(color) {
    // the hex input of the picker fires on every keystroke
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color ?? "")) return;
    if (color === businessObject.color) return;
    updateBusinessObject(businessObject.id, { color });
  }

  // Ratio field commits on blur; the stored value is the ratio (hours per
  // unit) whatever the displayed mode.
  function handleHoursRatioBlur() {
    if (!businessObject) return;
    const ratio = getHoursRatioFromDisplayed(
      parseHoursRatioInput(hoursRatioText),
      hoursRatioMode
    );
    if (ratio !== (businessObject.hoursRatio ?? null)) {
      updateBusinessObject(businessObject.id, { hoursRatio: ratio });
    } else {
      // normalize the text (e.g. "1,5" → "1.5", junk → "")
      setHoursRatioText(getHoursRatioInputText(ratio, hoursRatioMode));
    }
  }

  // The ratio unit is a task prop of its own (hoursRatioUnit): it drives the
  // h/x ⇄ x/h reading of the ratio and the quantity the hours budget is
  // rolled up from.
  function handleHoursRatioUnitChange(unit) {
    if (!businessObject) return;
    updateBusinessObject(businessObject.id, { hoursRatioUnit: unit });
  }

  // Mode switch persists the mode only: the ratio is untouched, the field
  // re-seeds from the effect above (cadence = 1 / ratio).
  function handleHoursRatioModeChange(_e, mode) {
    if (!mode || mode === hoursRatioMode) return;
    updateBusinessObject(businessObject.id, { hoursRatioMode: mode });
  }

  function handleToggleLinking() {
    dispatch(setLinkingBusinessObjectId(isLinking ? null : businessObject.id));
  }

  // Back to the object's listing properties: the LISTING selection wins over
  // the object branch in the routing. The solo display is untouched — the
  // object row toggle owns it.
  function handleBack() {
    dispatch(
      setSelectedItem({ id: businessObject.listingId, type: "LISTING" })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  async function handleUnlink(rel) {
    await db.relsBusinessObjectAnnotation.delete(rel.id);
    dispatch(triggerRelsBusinessObjectAnnotationUpdate());
  }

  async function handlePull() {
    if (pulling || !businessObject) return;
    await syncBusinessObject(businessObject);
  }

  // debug: the object as stored locally (row, listing / scope link
  // summaries, rels, linked annotations) to the clipboard
  async function handleDebugCopy() {
    try {
      const payload = buildBusinessObjectDebugPayload({
        businessObject,
        listing,
        scopeLink: notesAppLink,
        rels: rels ?? [],
        annotations: linkedRows.map(({ annotation }) => annotation),
      });
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      dispatch(setToaster({ message: "JSON de l'objet copié" }));
    } catch (e) {
      console.log("[businessObjects] debug copy failed", e);
      dispatch(
        setToaster({
          message: "Copie impossible (voir console)",
          isError: true,
        })
      );
    }
  }

  // "Retirer la localisation": the annotation stays linked, not main anymore
  async function handleUnsetMain(rel) {
    await unsetMainAnnotationService({ rel });
    dispatch(triggerRelsBusinessObjectAnnotationUpdate());
  }

  // render

  if (!businessObject) return null;

  const isClosed = hasStatus && isBusinessObjectClosed(businessObject);
  const closedAtS =
    isClosed && businessObject.closedAt
      ? `Clôturé le ${new Date(businessObject.closedAt).toLocaleDateString(
          "fr-FR"
        )}`
      : null;

  if (effectiveTab === "QTY" && openedTemplateKey !== null) {
    return (
      <PanelBusinessObjectTemplateAnnotations
        businessObject={businessObject}
        template={annotationTemplateById[openedTemplateKey]}
        rows={openedTemplateRows}
        baseMapNameById={baseMapNameById}
        spriteImage={spriteImage}
        onBack={() => setOpenedTemplateKey(null)}
        onUnlink={handleUnlink}
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1,
          pl: 0.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <IconButton onClick={handleBack} title="Propriétés de la liste">
          <Back />
        </IconButton>
        {hasColor && (
          <Box
            sx={{
              width: 14,
              height: 14,
              minWidth: 14,
              borderRadius: "2px",
              bgcolor: businessObject.color,
            }}
          />
        )}
        {hasStatus && (
          <Checkbox
            size="small"
            checked={isClosed}
            onChange={handleStatusChange}
            title={isClosed ? "Rouvrir" : "Fermer"}
            sx={{ p: 0.25 }}
          />
        )}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {[type.strings.objectLabel, closedAtS].filter(Boolean).join(" · ")}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
            {businessObject.label}
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={handleDebugCopy}
          title={debugTitleS}
          sx={{
            color: "text.disabled",
            textTransform: "none",
            fontSize: 12,
            minWidth: 0,
            px: 0.5,
          }}
        >
          debug
        </Button>
        {canPull &&
          (pulling ? (
            <CircularProgress size={18} sx={{ mx: 1 }} />
          ) : (
            <IconButton
              size="small"
              onClick={handlePull}
              title={pullTitleS}
              sx={{ flexShrink: 0 }}
            >
              <CloudDownload />
            </IconButton>
          ))}
      </Box>

      {/* tabs — Infos + Quantités, Fiche when the listing has a fields
          model, Notes for Krnet-imported objects (notes feed) */}
      <Tabs
        value={effectiveTab}
        onChange={(_e, v) => dispatch(setNotesAppObjectPropertiesTab(v))}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          borderBottom: "1px solid",
          borderColor: "divider",
          "& .MuiTab-root": { minHeight: 36 },
        }}
      >
        <Tab value="PROPS" label="Infos" />
        {hasQuantities && <Tab value="QTY" label="Quantités" />}
        {hasFiche && <Tab value="FICHE" label="Fiche" />}
        {isNotesAppObject && (
          <Tab
            value="NOTES"
            label={notesCount > 0 ? `Notes (${notesCount})` : "Notes"}
          />
        )}
      </Tabs>

      {effectiveTab === "NOTES" && (
        <SectionNotesAppObjectNotes businessObject={businessObject} />
      )}

      {effectiveTab === "FICHE" && (
        <SectionBusinessObjectFiche
          businessObject={businessObject}
          listing={listing}
          locatedBaseMapsCount={
            new Set(
              mainRows.map(
                ({ rel, annotation }) =>
                  rel.baseMapId ?? annotation.baseMapId ?? ""
              )
            ).size
          }
        />
      )}

      {effectiveTab === "PROPS" && (
        <Box sx={{ overflowY: "auto", flex: 1 }}>
          {/* props */}
          <Box
            sx={{
              p: 1.5,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box sx={{ display: "flex", gap: 1 }}>
              {hasCode && (
                <TextField
                  size="small"
                  label="Code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onBlur={handleCodeBlur}
                  onKeyDown={blurOnEnter}
                  sx={{ width: 100, flexShrink: 0 }}
                />
              )}
              <TextField
                fullWidth
                size="small"
                label="Nom"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={handleLabelBlur}
                onKeyDown={blurOnEnter}
              />
            </Box>
            <TextField
              fullWidth
              size="small"
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              multiline
              minRows={2}
            />
            {hasTitleRows && (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={Boolean(businessObject.isTitle)}
                    onChange={handleTitleChange}
                  />
                }
                label={<Typography variant="body2">Titre (bandeau)</Typography>}
                sx={{ ml: 0, mt: -1 }}
              />
            )}
            {hasQuantities && !hasHoursBudget && (
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Quantité de référence"
                  value={refQtyText}
                  onChange={(e) => setRefQtyText(e.target.value)}
                  onBlur={handleRefQtyBlur}
                  onKeyDown={blurOnEnter}
                />
                {/* free text; empty = unit-less row (a title, typically) */}
                <TextField
                  size="small"
                  label="Unité"
                  placeholder="u, ml, m²…"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  onBlur={handleUnitBlur}
                  onKeyDown={blurOnEnter}
                  sx={{ width: 110, flexShrink: 0 }}
                />
              </Box>
            )}
            {hasHoursBudget && (
              <FieldHoursRatioCompact
                text={hoursRatioText}
                onTextChange={setHoursRatioText}
                mode={hoursRatioMode}
                onModeChange={handleHoursRatioModeChange}
                unit={ratioUnit}
                onUnitChange={handleHoursRatioUnitChange}
                onBlur={handleHoursRatioBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.target.blur();
                }}
              />
            )}
            {hasHoursBudget && (
              <FieldTaskGlobalLayer
                value={businessObject.globalLayerId ?? ""}
                onChange={handleGlobalLayerChange}
              />
            )}
            {hasColor && (
              <FieldColorV2
                label="Couleur"
                value={businessObject.color}
                onChange={handleColorChange}
                options={{ showAsSection: true }}
              />
            )}
          </Box>

          {/* linked documents + main annotations (one per base map) */}
          <SectionBusinessObjectDocuments
            businessObjectId={businessObject.id}
          />
          {!hasQuantities && (
            <SectionBusinessObjectLinkedAnnotations
              rows={linkedRows}
              annotationTemplateById={annotationTemplateById}
              baseMapNameById={baseMapNameById}
              spriteImage={spriteImage}
              isLinking={isLinking}
              onToggleLinking={handleToggleLinking}
              onUnlink={handleUnlink}
              emptyLabel={type.strings.noLinkedAnnotations}
            />
          )}
          {mainRows.length > 0 && (
            <>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1.5,
                  py: 0.75,
                  bgcolor: "panel.sectionBg",
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Localisation
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {`${mainRows.length} plan${mainRows.length > 1 ? "s" : ""}`}
                </Typography>
              </Box>
              <List dense disablePadding>
                {mainRows.map(({ annotation, rel }) => {
                  const template =
                    annotationTemplateById[annotation.annotationTemplateId];
                  return (
                    <ListItem
                      key={annotation.id}
                      sx={{
                        py: 0.25,
                        "&:hover .business-object-unlink": {
                          visibility: "visible",
                        },
                      }}
                    >
                      <Box
                        sx={{ mr: 1, display: "flex", alignItems: "center" }}
                      >
                        <AnnotationTemplateIcon
                          template={template}
                          size={20}
                          spriteImage={spriteImage}
                        />
                      </Box>
                      <ListItemText
                        primary={
                          baseMapNameById[
                            rel.baseMapId ?? annotation.baseMapId
                          ] || "Plan"
                        }
                        secondary={template?.label}
                        slotProps={{
                          primary: { variant: "body2", noWrap: true },
                          secondary: { variant: "caption", noWrap: true },
                        }}
                      />
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 1, whiteSpace: "nowrap" }}
                      >
                        {getAnnotationMainQtyLabel(
                          annotation,
                          annotation.qties
                        )}
                      </Typography>
                      <IconButton
                        className="business-object-unlink"
                        size="small"
                        onClick={() => handleUnsetMain(rel)}
                        title="Retirer la localisation (l'annotation reste liée)"
                        sx={{ ml: 0.5, visibility: "hidden" }}
                      >
                        <LocationOff sx={{ fontSize: 16 }} />
                      </IconButton>
                      <IconButton
                        className="business-object-unlink"
                        size="small"
                        onClick={() => handleUnlink(rel)}
                        title="Délier cette annotation"
                        sx={{ visibility: "hidden" }}
                      >
                        <LinkOff sx={{ fontSize: 16 }} />
                      </IconButton>
                    </ListItem>
                  );
                })}
              </List>
              {type.features.assignByGeometry && (
                <ButtonAssignBusinessObjectAnnotations
                  businessObject={businessObject}
                />
              )}
            </>
          )}
        </Box>
      )}

      {effectiveTab === "QTY" && (
        <>
          {/* action: picking mode */}
          <Box sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <Button
              size="small"
              variant={isLinking ? "contained" : "outlined"}
              fullWidth
              onClick={handleToggleLinking}
              startIcon={<AddLink fontSize="small" />}
            >
              {isLinking ? "Quitter le mode liaison (Échap)" : "Mode liaison"}
            </Button>
          </Box>

          {/* hours budget (tasks) + quantity summary + template cards */}
          <Box sx={{ overflowY: "auto", flex: 1 }}>
            {/* tasks: rolled-up hours budget (own + sub-tasks) */}
            {hasHoursBudget && (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1.5,
                    py: 0.75,
                    bgcolor: "panel.sectionBg",
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Budget d&apos;heures
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatHours(totalHours ?? 0)}
                  </Typography>
                </Box>
                {!isValidHoursRatio(businessObject.hoursRatio) && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", px: 1.5, py: 0.5 }}
                  >
                    Renseignez un ratio pour calculer le budget de cette tâche.
                  </Typography>
                )}
                {hasChildren && (
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      dont sous-tâches
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatHours((totalHours ?? 0) - (ownHours ?? 0))}
                    </Typography>
                  </Box>
                )}
              </>
            )}
            <SectionBusinessObjectQuantities
              businessObject={businessObject}
              unit={hasHoursBudget ? ratioUnit : businessObject.unit}
              showRefQty={!hasHoursBudget}
              linkedRows={linkedRows}
              annotations={annotations}
              annotationTemplateById={annotationTemplateById}
              spriteImage={spriteImage}
              emptyLabel={type.strings.noLinkedAnnotations}
              onOpenTemplate={setOpenedTemplateKey}
            />
          </Box>
        </>
      )}
    </Box>
  );
}
