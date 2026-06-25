import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography, FormControl, Select, MenuItem } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

export default function FieldProcedure({ annotationTemplate, onChange }) {
  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  // helpers

  const value = annotationTemplate?.procedureKey ?? "";

  // handlers

  function handleChange(e) {
    const key = e.target.value;
    onChange({ ...annotationTemplate, procedureKey: key || null });
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
        <Select value={value} onChange={handleChange} displayEmpty>
          <MenuItem value="">
            <em>Aucune</em>
          </MenuItem>
          {procedures.map((proc) => (
            <MenuItem key={proc.key} value={proc.key}>
              {proc.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </WhiteSectionGeneric>
  );
}
