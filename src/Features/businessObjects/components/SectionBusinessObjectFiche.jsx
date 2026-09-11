import { useEffect, useState } from "react";

import {
  Avatar,
  Box,
  Checkbox,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import useUpdateBusinessObject from "../hooks/useUpdateBusinessObject";
import useBusinessObjectFieldsContext from "../hooks/useBusinessObjectFieldsContext";
import useBusinessObjectAvatarUrls from "../hooks/useBusinessObjectAvatarUrls";
import useNotesAppListingConfig from "Features/notesApp/hooks/useNotesAppListingConfig";
import { COLOR_HEX } from "Features/notesApp/utils/notesAppStateModels";
import { getBusinessObjectFieldValue } from "../utils/businessObjectFieldValues";

// "Fiche" tab of the business-object properties panel: one input per field
// of the listing model (Krnet "Modèle de fiche", listing.notesApp.settings
// .fields), in the model order. Editable: freeText, state (states of the
// field's state model), category (objects of the nomenclature listing),
// linkSingle / linkMulti (objects of the target listing). Read-only: photo
// (main photo of the object), location (main annotations count).
// linkIndirect fields (derived in Krnet) are not shown. Values are stored
// under businessObject.fieldValues (see businessObjectFieldValues.js); an
// input showing the Krnet snapshot commits a local value on edit.
export default function SectionBusinessObjectFiche({
  businessObject,
  listing,
  locatedBaseMapsCount = 0,
}) {
  // strings

  const noneS = "—";
  const noPhotoS = "Aucune photo";
  const notLocatedS = "Non localisé";
  const deletedStateModelS = "Liste d'état supprimée";
  const emptyModelS = "Le modèle de fiche de la liste n'a aucun champ.";

  // data

  const config = useNotesAppListingConfig(listing);
  const { fields, stateModelById } = config;
  const ctx = useBusinessObjectFieldsContext({ fields, stateModelById });
  const updateBusinessObject = useUpdateBusinessObject();
  const hasPhotoField = fields.some((f) => f.type === "photo");
  const avatarUrlById = useBusinessObjectAvatarUrls(
    businessObject ? [businessObject] : [],
    { enabled: hasPhotoField }
  );

  // helpers

  const locatedS =
    locatedBaseMapsCount > 0
      ? `Localisé sur ${locatedBaseMapsCount} plan${
          locatedBaseMapsCount > 1 ? "s" : ""
        }`
      : notLocatedS;

  const labelOf = (field) =>
    `${field.label || field.type}${field.required ? " *" : ""}`;

  const objectsOf = (listingId) =>
    (ctx.objectsByListingId[listingId] ?? []).filter((o) => !o.isTitle);

  // handlers

  function handleChange(field, value) {
    if (!businessObject?.id) return;
    updateBusinessObject(businessObject.id, {
      fieldValues: { [field.id]: value },
    });
  }

  // render

  if (!businessObject) return null;

  const visibleFields = fields.filter((f) => f.type !== "linkIndirect");

  return (
    <Box
      sx={{
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {visibleFields.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {emptyModelS}
        </Typography>
      )}

      {visibleFields.map((field) => {
        const value = getBusinessObjectFieldValue(businessObject, field, ctx);
        const label = labelOf(field);

        switch (field.type) {
          case "freeText":
            return (
              <FieldFicheText
                key={field.id}
                label={label}
                value={value ?? ""}
                onCommit={(v) => handleChange(field, v)}
              />
            );

          case "state": {
            const stateModel = stateModelById[field.stateModelId];
            const states = stateModel?.states ?? [];
            const known = states.some((s) => s.id === value);
            return (
              <TextField
                key={field.id}
                select
                fullWidth
                size="small"
                label={label}
                value={known ? value : ""}
                onChange={(e) => handleChange(field, e.target.value || null)}
                helperText={
                  stateModel?.deletedAt ? deletedStateModelS : undefined
                }
              >
                <MenuItem value="">{noneS}</MenuItem>
                {states.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: COLOR_HEX[s.color] ?? COLOR_HEX.blue,
                        mr: 1,
                        flexShrink: 0,
                      }}
                    />
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
            );
          }

          case "category":
          case "linkSingle": {
            const listingId =
              field.type === "category"
                ? field.nomenclatureListingId
                : field.targetListingId;
            const options = objectsOf(listingId);
            const known = options.some((o) => o.id === value);
            return (
              <TextField
                key={field.id}
                select
                fullWidth
                size="small"
                label={label}
                value={known ? value : ""}
                onChange={(e) => handleChange(field, e.target.value || null)}
              >
                <MenuItem value="">{noneS}</MenuItem>
                {options.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.label}
                    {o.code ? ` · ${o.code}` : ""}
                  </MenuItem>
                ))}
              </TextField>
            );
          }

          case "linkMulti": {
            const options = objectsOf(field.targetListingId);
            const ids = new Set(options.map((o) => o.id));
            const selected = (value ?? []).filter((id) => ids.has(id));
            const labelById = Object.fromEntries(
              options.map((o) => [o.id, o.label])
            );
            return (
              <TextField
                key={field.id}
                select
                fullWidth
                size="small"
                label={label}
                value={selected}
                onChange={(e) => handleChange(field, e.target.value)}
                slotProps={{
                  select: {
                    multiple: true,
                    renderValue: (v) => v.map((id) => labelById[id]).join(", "),
                  },
                }}
              >
                {options.map((o) => (
                  <MenuItem key={o.id} value={o.id} dense>
                    <Checkbox
                      size="small"
                      checked={selected.includes(o.id)}
                      sx={{ p: 0, mr: 1 }}
                    />
                    <ListItemText
                      primary={o.label}
                      slotProps={{ primary: { variant: "body2" } }}
                    />
                  </MenuItem>
                ))}
              </TextField>
            );
          }

          case "photo": {
            const url = avatarUrlById[businessObject.id];
            return (
              <Box key={field.id}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {url ? (
                    <Avatar
                      variant="rounded"
                      src={url}
                      sx={{ width: 56, height: 56 }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      {noPhotoS}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          }

          case "location":
            return (
              <Box key={field.id}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="body2">{locatedS}</Typography>
              </Box>
            );

          default:
            return null;
        }
      })}
    </Box>
  );
}

// Multi-line text committed on blur (Enter without shift blurs), like the
// Nom / Description fields of the properties tab.
function FieldFicheText({ label, value, onCommit }) {
  // state

  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  // handlers

  function handleBlur() {
    if (text !== value) onCommit(text);
  }

  // render

  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) e.target.blur();
      }}
      multiline
      maxRows={4}
    />
  );
}
