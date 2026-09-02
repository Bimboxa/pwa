import { useState } from "react";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import { CirclePicker } from "react-color";
import defaultColors from "Features/colors/data/defaultColors";

import useCreateBusinessObject from "../hooks/useCreateBusinessObject";
import useUpdateBusinessObject from "../hooks/useUpdateBusinessObject";

import {
  BUSINESS_OBJECT_UNITS,
  DEFAULT_BUSINESS_OBJECT_UNIT,
  DEFAULT_BUSINESS_OBJECT_COLOR,
} from "../constants/businessObjectEntityModel";

// Create / edit form of a business object: label, color, optional
// description, quantity unit. Edit mode when `businessObject` is provided.
export default function DialogBusinessObjectForm({
  open,
  listing,
  parentBusinessObject,
  businessObject,
  onClose,
}) {
  const createBusinessObject = useCreateBusinessObject();
  const updateBusinessObject = useUpdateBusinessObject();

  // state

  const isEdit = Boolean(businessObject);
  const [label, setLabel] = useState(businessObject?.label ?? "");
  const [color, setColor] = useState(
    businessObject?.color ??
      parentBusinessObject?.color ??
      DEFAULT_BUSINESS_OBJECT_COLOR
  );
  const [description, setDescription] = useState(
    businessObject?.description ?? ""
  );
  // "" = unit-less (stored as null)
  const [unit, setUnit] = useState(
    isEdit
      ? (businessObject?.unit ?? "")
      : DEFAULT_BUSINESS_OBJECT_UNIT
  );
  const [isTitle, setIsTitle] = useState(Boolean(businessObject?.isTitle));

  // strings

  const title = isEdit
    ? "Modifier l'ouvrage"
    : parentBusinessObject
      ? `Nouveau sous-ouvrage de "${parentBusinessObject.label}"`
      : "Nouvel ouvrage";

  // handlers

  async function handleSubmit() {
    if (!label) return;
    if (isEdit) {
      await updateBusinessObject(businessObject.id, {
        label,
        color,
        description,
        unit: unit || null,
        isTitle,
      });
    } else {
      await createBusinessObject({
        listing,
        parentId: parentBusinessObject?.id ?? null,
        label,
        color,
        description,
        unit: unit || null,
        isTitle,
      });
    }
    onClose();
  }

  // Checking "Titre" clears a still-default unit (titles are usually
  // unit-less); an explicitly chosen unit is kept.
  function handleTitleChange(e) {
    const checked = e.target.checked;
    setIsTitle(checked);
    if (checked && !isEdit && unit === DEFAULT_BUSINESS_OBJECT_UNIT)
      setUnit("");
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Nom"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && label) handleSubmit();
          }}
          sx={{ mt: 1 }}
        />
        <TextField
          fullWidth
          size="small"
          label="Description (optionnelle)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={2}
          sx={{ mt: 2 }}
        />
        <FormControlLabel
          control={
            <Checkbox size="small" checked={isTitle} onChange={handleTitleChange} />
          }
          label={<Typography variant="body2">Titre (bandeau)</Typography>}
          sx={{ mt: 1, ml: 0 }}
        />
        <TextField
          select
          fullWidth
          size="small"
          label="Unité de quantité"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          sx={{ mt: 1 }}
        >
          <MenuItem value="">—</MenuItem>
          {BUSINESS_OBJECT_UNITS.map((u) => (
            <MenuItem key={u.key} value={u.key}>
              {u.label}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
          <CirclePicker
            onChange={(c) => setColor(c.hex)}
            color={color}
            colors={defaultColors}
            circleSize={20}
            circleSpacing={9}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!label}>
          {isEdit ? "Modifier" : "Créer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
