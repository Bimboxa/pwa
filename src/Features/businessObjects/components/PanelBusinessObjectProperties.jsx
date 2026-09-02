import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  setLinkingBusinessObjectId,
  triggerRelsBusinessObjectAnnotationUpdate,
} from "../businessObjectsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

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
  TextField,
  Typography,
} from "@mui/material";
import { AddLink, LinkOff, ArrowBack as Back } from "@mui/icons-material";

import { CirclePicker } from "react-color";
import defaultColors from "Features/colors/data/defaultColors";

import db from "App/db/db";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useRelsBusinessObjectAnnotation from "../hooks/useRelsBusinessObjectAnnotation";
import useUpdateBusinessObject from "../hooks/useUpdateBusinessObject";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import getAnnotationMainQtyLabel from "Features/annotations/utils/getAnnotationMainQtyLabel";
import getBusinessObjectQtyLabel from "../utils/getBusinessObjectQtyLabel";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

import { BUSINESS_OBJECT_UNITS } from "../constants/businessObjectEntityModel";

// Right-panel properties of a business object selected in the Ouvrages
// drawer: editable props (label, color, description, unit), the list of the
// linked annotations with per-annotation quantities and unlink buttons, the
// rolled-up total per the object's unit, and the picking-mode toggle.
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

  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  // state — label & description edited locally, committed on blur

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setLabel(businessObject?.label ?? "");
    setDescription(businessObject?.description ?? "");
  }, [businessObject?.id, businessObject?.label, businessObject?.description]);

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

  function handleToggleLinking() {
    dispatch(
      setLinkingBusinessObjectId(isLinking ? null : businessObject.id)
    );
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
        <Box
          sx={{
            width: 14,
            height: 14,
            minWidth: 14,
            borderRadius: "2px",
            bgcolor: businessObject.color,
          }}
        />
        <Box>
          <Typography variant="caption" color="text.secondary">
            Ouvrage
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {businessObject.label}
          </Typography>
        </Box>
      </Box>

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
        <TextField
          select
          fullWidth
          size="small"
          label="Unité de quantité"
          value={businessObject.unit ?? ""}
          onChange={handleUnitChange}
        >
          <MenuItem value="">—</MenuItem>
          {BUSINESS_OBJECT_UNITS.map((u) => (
            <MenuItem key={u.key} value={u.key}>
              {u.label}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <CirclePicker
            onChange={handleColorChange}
            color={businessObject.color}
            colors={defaultColors}
            circleSize={16}
            circleSpacing={9}
          />
        </Box>
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

      {/* linked annotations + total */}
      <Box sx={{ overflowY: "auto", flex: 1 }}>
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
            {getBusinessObjectQtyLabel(businessObject.unit, qties)}
          </Typography>
        </Box>
        {linkedRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            Aucune annotation liée à cet ouvrage
          </Typography>
        ) : (
          <List dense disablePadding>
            {linkedRows.map(({ annotation, rel }) => {
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
                <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
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
                  slotProps={{ primary: { variant: "body2", noWrap: true } }}
                />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 1, whiteSpace: "nowrap" }}
                >
                  {getAnnotationMainQtyLabel(annotation, annotation.qties)}
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
    </Box>
  );
}
