import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {
  Box,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Chip,
} from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

export default function FieldProcedure({ annotationTemplate, onChange }) {
  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  // helpers

  const value = annotationTemplate?.procedureKeys ?? [];

  const labelByKey = new Map(procedures.map((p) => [p.key, p.label]));

  // handlers

  function handleChange(e) {
    const keys = e.target.value;
    onChange({ ...annotationTemplate, procedureKeys: keys });
  }

  // render

  if (procedures.length === 0) return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Procédure
        </Typography>
      </Box>

      <FormControl fullWidth size="small">
        <Select
          multiple
          value={value}
          onChange={handleChange}
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
              <Checkbox checked={value.includes(proc.key)} size="small" />
              <ListItemText primary={proc.label} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </WhiteSectionGeneric>
  );
}
