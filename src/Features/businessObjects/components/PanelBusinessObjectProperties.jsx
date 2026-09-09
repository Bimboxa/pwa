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

import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddLink,
  LinkOff,
  ArrowBack as Back,
  LocationOff,
} from "@mui/icons-material";

import { CirclePicker } from "react-color";
import defaultColors from "Features/colors/data/defaultColors";

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
import FieldHoursRatioCompact from "./FieldHoursRatioCompact";
import SectionNotesAppObjectNotes from "Features/notesApp/components/SectionNotesAppObjectNotes";
import getAnnotationMainQtyLabel from "Features/annotations/utils/getAnnotationMainQtyLabel";
import getBusinessObjectQtyLabel from "../utils/getBusinessObjectQtyLabel";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import getHoursRatioUnit from "../utils/getHoursRatioUnit";
import {
  formatHours,
  getHoursRatioFromDisplayed,
  getHoursRatioInputText,
  isValidHoursRatio,
  parseHoursRatioInput,
} from "../utils/hoursRatioConversions";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

import {
  BUSINESS_OBJECT_UNITS,
  DEFAULT_HOURS_RATIO_MODE,
} from "../constants/businessObjectEntityModel";

// Right-panel properties of a business object selected in the Ouvrages
// drawer: editable props (label, description, unit, color — the field set
// follows the listing type features), the object's MAIN annotations (one
// per base map, "Localisation" section, drawn from the Dessin popper), the
// list of the other linked annotations with per-annotation quantities and
// unlink buttons, the rolled-up total per the object's unit, and the
// picking-mode toggle. Tasks (type feature hoursBudget) replace the unit
// with the hours ratio field (Ratio / Cadence), add the rolled-up hours
// budget band and have no color (feature color false).
export default function PanelBusinessObjectProperties() {
  const dispatch = useDispatch();

  // data — selected object

  const businessObjectId = useSelector(
    (s) => s.businessObjects.selectedBusinessObjectId
  );
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

  // state — label & description edited locally, committed on blur

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  // ratio field text in the task's persisted mode ("" = no ratio)
  const [hoursRatioText, setHoursRatioText] = useState("");

  const hoursRatioMode =
    businessObject?.hoursRatioMode ?? DEFAULT_HOURS_RATIO_MODE;

  useEffect(() => {
    setLabel(businessObject?.label ?? "");
    setDescription(businessObject?.description ?? "");
    setHoursRatioText(
      getHoursRatioInputText(businessObject?.hoursRatio, hoursRatioMode)
    );
  }, [
    businessObject?.id,
    businessObject?.label,
    businessObject?.description,
    businessObject?.hoursRatio,
    hoursRatioMode,
  ]);

  // state — tabs: the "Notes" tab shows the Krnet notes feed of an imported
  // object (photos, comments, events... under businessObject.notesAppNotes).
  // The selection lives in Redux so browsing from object to object keeps the
  // Notes tab open; non-Krnet objects (no tab bar) fall back to "PROPS".

  const tab = useSelector((s) => s.notesApp.objectPropertiesTab);
  const isNotesAppObject = businessObject?.remoteSource === "notesApp";
  const notesCount = businessObject?.notesAppNotes?.length ?? 0;
  const effectiveTab = isNotesAppObject && tab === "NOTES" ? "NOTES" : "PROPS";

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

  // main annotations ("Localisation") vs plain links ("Annotations liées");
  // the quantity rollup counts both.
  const mainRows = useMemo(
    () => linkedRows.filter(({ rel }) => rel.isMain),
    [linkedRows]
  );
  const plainRows = useMemo(
    () => linkedRows.filter(({ rel }) => !rel.isMain),
    [linkedRows]
  );

  const qties = useMemo(() => {
    const stats = { count: 0, length: 0, surface: 0 };
    linkedRows.forEach(({ annotation }) => {
      if (annotation.isMeshCell) return;
      const qty = annotation.qties;
      stats.count += Number.isFinite(qty?.count) ? qty.count : 1;
      if (qty?.enabled) {
        const length =
          qty.lengthDeveloped != null ? qty.lengthDeveloped : qty.length;
        const surface =
          qty.surfaceDeveloped != null ? qty.surfaceDeveloped : qty.surface;
        if (Number.isFinite(length)) stats.length += length;
        if (Number.isFinite(surface)) stats.surface += surface;
      }
    });
    return stats;
  }, [linkedRows]);

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

  function handleUnitChange(e) {
    // "" = unit-less (stored as null)
    updateBusinessObject(businessObject.id, { unit: e.target.value || null });
  }

  function handleTitleChange(e) {
    updateBusinessObject(businessObject.id, { isTitle: e.target.checked });
  }

  function handleColorChange(color) {
    updateBusinessObject(businessObject.id, { color: color.hex });
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

  // "Retirer la localisation": the annotation stays linked, not main anymore
  async function handleUnsetMain(rel) {
    await unsetMainAnnotationService({ rel });
    dispatch(triggerRelsBusinessObjectAnnotationUpdate());
  }

  // render

  if (!businessObject) return null;

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
        <Box>
          <Typography variant="caption" color="text.secondary">
            {type.strings.objectLabel}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {businessObject.label}
          </Typography>
        </Box>
      </Box>

      {/* tabs — only Krnet-imported objects carry a notes feed */}
      {isNotesAppObject && (
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
          <Tab value="PROPS" label="Propriétés" />
          <Tab
            value="NOTES"
            label={notesCount > 0 ? `Notes (${notesCount})` : "Notes"}
          />
        </Tabs>
      )}

      {effectiveTab === "NOTES" && (
        <SectionNotesAppObjectNotes businessObject={businessObject} />
      )}

      {effectiveTab !== "NOTES" && (
        <>
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
            <TextField
              fullWidth
              size="small"
              label="Nom"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleLabelBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.target.blur();
              }}
            />
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
            {!hasHoursBudget && (
              <TextField
                select
                fullWidth
                size="small"
                label="Unité de quantité"
                value={businessObject.unit ?? ""}
                onChange={handleUnitChange}
              >
                {/* "—" = unit-less row (a title, typically) */}
                <MenuItem value="">—</MenuItem>
                {BUSINESS_OBJECT_UNITS.map((u) => (
                  <MenuItem key={u.key} value={u.key}>
                    {u.label}
                  </MenuItem>
                ))}
              </TextField>
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
            {hasColor && (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <CirclePicker
                  onChange={handleColorChange}
                  color={businessObject.color}
                  colors={defaultColors}
                  circleSize={16}
                  circleSpacing={9}
                />
              </Box>
            )}
          </Box>

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

          {/* main annotations (one per base map) + linked annotations + total */}
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
              </>
            )}
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
                Annotations liées
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getBusinessObjectQtyLabel(
                  hasHoursBudget ? ratioUnit : businessObject.unit,
                  qties
                )}
              </Typography>
            </Box>
            {plainRows.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                {type.strings.noLinkedAnnotations}
              </Typography>
            ) : (
              <List dense disablePadding>
                {plainRows.map(({ annotation, rel }) => {
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
                          annotation.label ?? template?.label ?? "Annotation"
                        }
                        slotProps={{
                          primary: { variant: "body2", noWrap: true },
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
                        onClick={() => handleUnlink(rel)}
                        title="Délier cette annotation"
                        sx={{ ml: 0.5, visibility: "hidden" }}
                      >
                        <LinkOff sx={{ fontSize: 16 }} />
                      </IconButton>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
