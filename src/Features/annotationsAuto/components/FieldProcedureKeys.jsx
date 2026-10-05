import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {
  Box,
  FormControl,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Chip,
} from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";

/**
 * Multi-select of the automated procedures (appConfig registry), as a white
 * section. `value` / `onChange` carry the array of procedure keys — stored as
 * `procedureKeys` on an annotation template or on a listing.
 */
export default function FieldProcedureKeys({
  value,
  onChange,
  label = "Procédure",
}) {
  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  // helpers

  const keys = value ?? [];

  const labelByKey = new Map(procedures.map((p) => [p.key, p.label]));

  // render

  if (procedures.length === 0) return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ mb: 1 }}>
        <WhiteSectionTitle>{label}</WhiteSectionTitle>
      </Box>

      <FormControl fullWidth size="small">
        <Select
          multiple
          value={keys}
          onChange={(e) => onChange(e.target.value)}
          displayEmpty
          renderValue={(selected) =>
            selected.length === 0 ? (
              <em>Aucune</em>
            ) : (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {selected.map((key) => (
                  <Chip
                    key={key}
                    size="small"
                    label={labelByKey.get(key) ?? key}
                  />
                ))}
              </Box>
            )
          }
        >
          {procedures.map((proc) => (
            <MenuItem key={proc.key} value={proc.key}>
              <Checkbox checked={keys.includes(proc.key)} size="small" />
              <ListItemText primary={proc.label} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </WhiteSectionGeneric>
  );
}
