/* eslint-disable react/prop-types */
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
  ListSubheader,
} from "@mui/material";
import {
  ChevronRight,
  Close,
  DeleteOutline,
  DragIndicator,
} from "@mui/icons-material";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import getStrokeWidthLabel from "Features/annotations/utils/getStrokeWidthLabel";
import ColorPickerContent from "Features/colors/components/ColorPickerContent";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import IconStrip from "Features/icons/IconStrip";
import IconPolylineClick from "Features/icons/IconPolylineClick";
import { mappedTemplate, templateType } from "../utils/aiTaskMappings";

export default function AiTaskMappingRow({
  row,
  templates,
  listings,
  destinationId,
  disabled,
  onChange,
  onDelete,
  onOpen,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled });
  const [anchor, setAnchor] = useState(null);
  const draft = row.newModelDraft;
  const template = draft ?? mappedTemplate(row, templates);
  const type = templateType(template) ?? row.type;
  const color = template?.strokeColor ?? template?.fillColor ?? row.strokeColor;
  const isNew = Boolean(draft);
  const strokeWidthLabel =
    template && type === "POLYLINE" ? getStrokeWidthLabel(template) : null;
  const updateDraft = (patch) =>
    onChange({ newModelDraft: { ...draft, ...patch } });
  const options = [...new Set(templates.map((t) => t.listingId))].sort(
    (a, b) => (a === destinationId ? -1 : b === destinationId ? 1 : 0)
  );
  return (
    <Box
      ref={setNodeRef}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 2 : "auto",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1,
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Tooltip title="Réorganiser">
          <IconButton
            size="small"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Réorganiser — ${row.detectionLabel}`}
            disabled={disabled}
            sx={{ cursor: "grab", touchAction: "none", p: 0.25 }}
          >
            <DragIndicator fontSize="small" />
          </IconButton>
        </Tooltip>
        <TextField
          variant="standard"
          fullWidth
          value={row.detectionLabel}
          placeholder="Ouvrage à repérer"
          disabled={disabled}
          inputProps={{ "aria-label": "Ouvrage à repérer", maxLength: 200 }}
          onChange={(e) => onChange({ detectionLabel: e.target.value })}
        />
        <IconButton
          size="small"
          aria-label={`Supprimer — ${row.detectionLabel}`}
          disabled={disabled}
          onClick={onDelete}
        >
          <DeleteOutline fontSize="small" />
        </IconButton>
        <Tooltip title="Description et exemple">
          <IconButton
            size="small"
            aria-label={`Détails — ${row.detectionLabel || "ouvrage"}`}
            onClick={onOpen}
          >
            <ChevronRight fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {!draft && !row.templateId && (
        <TextField
          select
          fullWidth
          size="small"
          value={row.templateId}
          disabled={disabled}
          sx={{ mt: 0.75 }}
          SelectProps={{ displayEmpty: true }}
          inputProps={{ "aria-label": `Modèle pour ${row.detectionLabel}` }}
          onChange={(e) => {
            if (e.target.value === "create") {
              onChange({
                newModelDraft: {
                  label: row.label || row.detectionLabel,
                  type: row.type,
                  strokeColor: row.strokeColor,
                },
              });
            } else onChange({ templateId: e.target.value });
          }}
        >
          <MenuItem value="" disabled>
            Choisir ou créer un modèle
          </MenuItem>
          {row.templateId === "new" && (
            <MenuItem value="new">{row.label} · Nouveau modèle</MenuItem>
          )}
          <MenuItem value="create">＋ Créer un nouveau modèle</MenuItem>
          {options.flatMap((id) => [
            <ListSubheader key={`group-${id}`}>
              {listings.find((l) => l.id === id)?.name ?? "Autre liste"}
              {id === destinationId ? " · destination" : " · copie"}
            </ListSubheader>,
            ...templates
              .filter((t) => t.listingId === id)
              .map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  <Box
                    component="span"
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: 0.5,
                      bgcolor: t.strokeColor ?? t.fillColor,
                      mr: 1,
                    }}
                  />
                  {t.label}
                </MenuItem>
              )),
          ])}
        </TextField>
      )}
      {!draft && row.templateId && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mt: 0.75, minHeight: 36 }}
        >
          {template && (
            <Box
              sx={{
                width: 32,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <AnnotationTemplateIcon
                template={template}
                size={24}
                use3D={false}
              />
              {strokeWidthLabel && (
                <Typography
                  component="span"
                  sx={{
                    fontSize: "9px",
                    lineHeight: 1,
                    fontFamily: "monospace",
                    color: "text.secondary",
                  }}
                >
                  {strokeWidthLabel}
                </Typography>
              )}
            </Box>
          )}
          <Typography
            variant="body2"
            sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}
          >
            {template?.label ?? "Modèle indisponible"}
          </Typography>
          <Tooltip title="Changer de modèle">
            <IconButton
              size="small"
              disabled={disabled}
              aria-label={`Changer de modèle — ${row.detectionLabel}`}
              onClick={() => onChange({ templateId: "" })}
            >
              <Close fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
      <Box
        sx={
          draft
            ? {
                mt: 1,
                p: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }
            : {}
        }
      >
        {draft && <Typography variant="subtitle2">Nouveau modèle</Typography>}
        {draft && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mt: 0.5 }}
          >
            <Tooltip title={isNew ? "Couleur du tracé" : "Couleur du modèle"}>
              <span>
                <IconButton
                  size="small"
                  disabled={disabled || !isNew}
                  onClick={(e) => setAnchor(e.currentTarget)}
                  aria-label="Couleur du modèle"
                >
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: 0.5,
                      bgcolor: color,
                    }}
                  />
                </IconButton>
              </span>
            </Tooltip>
            {isNew ? (
              <TextField
                value={draft.label}
                onChange={(e) => updateDraft({ label: e.target.value })}
                size="small"
                placeholder="Nom du nouveau modèle"
                inputProps={{
                  "aria-label": "Nom du nouveau modèle",
                  maxLength: 200,
                }}
                disabled={disabled}
                sx={{ flex: 1, minWidth: 60 }}
              />
            ) : (
              <Typography variant="body2" sx={{ flex: 1 }}>
                {row.templateId === "new"
                  ? "Créé à l’exécution"
                  : template?.listingId === destinationId
                    ? "Réutilisé"
                    : "Copié à l’exécution"}
              </Typography>
            )}
            <ToggleSingleSelectorGeneric
              selectedKey={type}
              disabled={disabled || !isNew}
              onChange={(value) => value && updateDraft({ type: value })}
              options={[
                {
                  key: "STRIP",
                  label: "Bande (stripe)",
                  icon: <IconStrip sx={{ color }} />,
                },
                {
                  key: "POLYLINE",
                  label: "Polyligne",
                  icon: <IconPolylineClick sx={{ color }} />,
                },
              ]}
            />
          </Stack>
        )}
        {draft && (
          <Stack
            direction="row"
            justifyContent="flex-end"
            spacing={1}
            sx={{ mt: 1 }}
          >
            <Button
              size="small"
              disabled={disabled}
              onClick={() => {
                setAnchor(null);
                onChange({ newModelDraft: null });
              }}
            >
              Annuler
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={
                disabled ||
                !draft.label?.trim() ||
                !/^#[0-9a-f]{6}$/i.test(draft.strokeColor)
              }
              onClick={() => {
                setAnchor(null);
                onChange({
                  ...draft,
                  label: draft.label.trim(),
                  templateId: "new",
                  newModelDraft: null,
                });
              }}
            >
              Enregistrer
            </Button>
          </Stack>
        )}
      </Box>
      <Popover
        open={Boolean(anchor) && !disabled}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <ColorPickerContent
          color={draft?.strokeColor ?? row.strokeColor}
          onColorChange={(strokeColor) => updateDraft({ strokeColor })}
          onClose={() => setAnchor(null)}
        />
      </Popover>
    </Box>
  );
}
