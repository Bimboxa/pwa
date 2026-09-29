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
  TextField,
  Typography,
} from "@mui/material";

import FieldColorV2 from "Features/form/components/FieldColorV2";
import FieldHoursRatioCompact from "./FieldHoursRatioCompact";
import FieldTaskGlobalLayer from "./FieldTaskGlobalLayer";

import useCreateBusinessObject from "../hooks/useCreateBusinessObject";
import useUpdateBusinessObject from "../hooks/useUpdateBusinessObject";

import {
  DEFAULT_BUSINESS_OBJECT_UNIT,
  DEFAULT_BUSINESS_OBJECT_COLOR,
  DEFAULT_HOURS_RATIO_MODE,
} from "../constants/businessObjectEntityModel";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import getHoursRatioUnit from "../utils/getHoursRatioUnit";
import { getBusinessObjectUnitText } from "../utils/getBusinessObjectQtyKind";
import formatBusinessObjectNumber from "../utils/formatBusinessObjectNumber";
import {
  getHoursRatioFromDisplayed,
  getHoursRatioInputText,
  parseHoursRatioInput,
} from "../utils/hoursRatioConversions";

// Create / edit form of a business object. The field set follows the
// listing type (businessObjectTypesCatalog features): code + label +
// optional description + "Titre" for every type; quantity unit (free text),
// reference quantity and color for the types carrying them; tasks (feature hoursBudget) replace the unit with the
// hours ratio as a compact one-line row (FieldHoursRatioCompact, the ratio
// carries its own unit) and have no color (feature color false). The stored
// ratio is always hours per unit, the mode toggle only flips the displayed
// number. Types without the features code / titleRows / quantities (issues)
// drop those fields: label + description only. Edit mode when
// `businessObject` is provided.
export default function DialogBusinessObjectForm({
  open,
  listing,
  parentBusinessObject,
  businessObject,
  onClose,
}) {
  const createBusinessObject = useCreateBusinessObject();
  const updateBusinessObject = useUpdateBusinessObject();

  // data

  const type = getBusinessObjectTypeOfListing(listing);
  const hasHoursBudget = Boolean(type.features?.hoursBudget);
  const hasColor = Boolean(type.features?.color);
  const hasQuantities = Boolean(type.features?.quantities);
  const hasCode = Boolean(type.features?.code);
  const hasTitleRows = Boolean(type.features?.titleRows);

  // state

  const isEdit = Boolean(businessObject);
  const [label, setLabel] = useState(businessObject?.label ?? "");
  const [code, setCode] = useState(businessObject?.code ?? "");
  const [color, setColor] = useState(
    businessObject?.color ??
      parentBusinessObject?.color ??
      DEFAULT_BUSINESS_OBJECT_COLOR
  );
  const [description, setDescription] = useState(
    businessObject?.description ?? ""
  );
  // free text, "" = unit-less (stored as null)
  const [unit, setUnit] = useState(
    isEdit
      ? getBusinessObjectUnitText(businessObject?.unit)
      : DEFAULT_BUSINESS_OBJECT_UNIT
  );
  // reference quantity text ("" = none)
  const initialRefQtyText = Number.isFinite(businessObject?.refQty)
    ? formatBusinessObjectNumber(businessObject.refQty, 3)
    : "";
  const [refQtyText, setRefQtyText] = useState(initialRefQtyText);
  const [isTitle, setIsTitle] = useState(Boolean(businessObject?.isTitle));
  // hours ratio (tasks): mode + field text in that mode ("" = no ratio)
  const [hoursRatioMode, setHoursRatioMode] = useState(
    businessObject?.hoursRatioMode ?? DEFAULT_HOURS_RATIO_MODE
  );
  const [hoursRatioText, setHoursRatioText] = useState(() =>
    getHoursRatioInputText(
      businessObject?.hoursRatio,
      businessObject?.hoursRatioMode ?? DEFAULT_HOURS_RATIO_MODE
    )
  );
  // unit of the ratio (tasks): m² by default, legacy fallback on `unit`
  const [hoursRatioUnit, setHoursRatioUnit] = useState(() =>
    getHoursRatioUnit(businessObject)
  );
  // global layer of the task (tasks): "" = every annotation
  const [globalLayerId, setGlobalLayerId] = useState(
    businessObject?.globalLayerId ?? ""
  );

  // strings

  const title = isEdit
    ? type.strings.editObject
    : parentBusinessObject
      ? `${type.strings.newChildPrefix} "${parentBusinessObject.label}"`
      : type.strings.newObject;

  // handlers

  async function handleSubmit() {
    if (!label) return;
    // undefined = field untouched (non-task listings)
    const ratioProps = hasHoursBudget
      ? {
          hoursRatio: getHoursRatioFromDisplayed(
            parseHoursRatioInput(hoursRatioText),
            hoursRatioMode
          ),
          hoursRatioMode,
          hoursRatioUnit,
          globalLayerId: globalLayerId || null,
        }
      : {};
    // tasks have no quantity unit: that one belongs to priced articles
    // (nor the types without quantities)
    const hasUnit = hasQuantities && !hasHoursBudget;
    const unitProp = hasUnit ? unit.trim() || null : null;
    // untouched text: the stored value (maybe more precise) is kept
    const refQtyProp =
      !hasUnit || refQtyText === initialRefQtyText
        ? {}
        : { refQty: parseHoursRatioInput(refQtyText.replace(/\s/g, "")) };
    // undefined = field untouched (types without the feature)
    const codeProp = hasCode ? { code: code.trim() } : {};
    const isTitleProp = hasTitleRows ? { isTitle } : {};
    if (isEdit) {
      await updateBusinessObject(businessObject.id, {
        label,
        ...codeProp,
        ...(hasColor ? { color } : {}),
        description,
        unit: unitProp,
        ...refQtyProp,
        ...isTitleProp,
        ...ratioProps,
      });
    } else {
      await createBusinessObject({
        listing,
        parentId: parentBusinessObject?.id ?? null,
        label,
        ...codeProp,
        ...(hasColor ? { color } : {}),
        description,
        unit: unitProp,
        ...refQtyProp,
        ...isTitleProp,
        ...ratioProps,
      });
    }
    onClose();
  }

  // Checking "Titre" clears a still-default unit (titles are usually
  // unit-less); an explicitly chosen unit is kept. Tasks keep their unit
  // (the ratio needs one).
  function handleTitleChange(e) {
    const checked = e.target.checked;
    setIsTitle(checked);
    if (
      checked &&
      !isEdit &&
      !hasHoursBudget &&
      unit === DEFAULT_BUSINESS_OBJECT_UNIT
    )
      setUnit("");
  }

  // Ratio ⇄ Cadence: the ratio behind the field is invariant, only the
  // displayed number flips (1 / x).
  function handleHoursRatioModeChange(_e, newMode) {
    if (!newMode || newMode === hoursRatioMode) return;
    const ratio = getHoursRatioFromDisplayed(
      parseHoursRatioInput(hoursRatioText),
      hoursRatioMode
    );
    setHoursRatioMode(newMode);
    setHoursRatioText(getHoursRatioInputText(ratio, newMode));
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          {hasCode && (
            <TextField
              size="small"
              label="Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              sx={{ width: 110, flexShrink: 0 }}
            />
          )}
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
          />
        </Box>
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
        {hasTitleRows && (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={isTitle}
                onChange={handleTitleChange}
              />
            }
            label={<Typography variant="body2">Titre (bandeau)</Typography>}
            sx={{ mt: 1, ml: 0 }}
          />
        )}
        {hasQuantities && !hasHoursBudget && (
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Quantité de référence"
              value={refQtyText}
              onChange={(e) => setRefQtyText(e.target.value)}
            />
            {/* free text; empty = unit-less row (a title, typically) */}
            <TextField
              size="small"
              label="Unité"
              placeholder="u, ml, m²…"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              sx={{ width: 130, flexShrink: 0 }}
            />
          </Box>
        )}
        {hasHoursBudget && (
          <Box sx={{ mt: 2 }}>
            <FieldHoursRatioCompact
              text={hoursRatioText}
              onTextChange={setHoursRatioText}
              mode={hoursRatioMode}
              onModeChange={handleHoursRatioModeChange}
              unit={hoursRatioUnit}
              onUnitChange={setHoursRatioUnit}
            />
            <Box sx={{ mt: 2 }}>
              <FieldTaskGlobalLayer
                value={globalLayerId}
                onChange={setGlobalLayerId}
              />
            </Box>
          </Box>
        )}
        {hasColor && (
          <Box sx={{ mt: 2 }}>
            <FieldColorV2
              label="Couleur"
              value={color}
              onChange={setColor}
              options={{ showAsSection: true }}
            />
          </Box>
        )}
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
