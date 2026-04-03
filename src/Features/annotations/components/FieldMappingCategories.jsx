import { useState } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography, IconButton, Chip } from "@mui/material";
import { Add } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import DialogAddMappingCategories from "./DialogAddMappingCategories";

export default function FieldMappingCategories({ annotationTemplate, onChange }) {
  // data

  const appConfig = useAppConfig();
  const allMappingCategories = appConfig?.mappingCategories;

  // state

  const [dialogOpen, setDialogOpen] = useState(false);

  // helpers

  const currentCategories = annotationTemplate?.mappingCategories ?? [];

  function resolveLabel(categoryString) {
    if (!categoryString || typeof categoryString !== "string") return categoryString;
    const [nomenclatureKey, categoryKey] = categoryString.split(":");
    if (!nomenclatureKey || !categoryKey) return categoryString;

    const nomenclature = allMappingCategories?.find(
      (n) => n.nomenclature.key === nomenclatureKey
    );
    if (!nomenclature) return categoryString;

    const category = nomenclature.categories.find((c) => c.key === categoryKey);
    if (!category) return `${nomenclature.nomenclature.label} > ${categoryKey}`;

    return `${nomenclature.nomenclature.label} > ${category.label}`;
  }

  // handlers

  function handleDelete(categoryString) {
    const updated = currentCategories.filter((c) => c !== categoryString);
    onChange({ ...annotationTemplate, mappingCategories: updated });
  }

  function handleAdd(newCategories) {
    const merged = [...currentCategories, ...newCategories];
    onChange({ ...annotationTemplate, mappingCategories: merged });
  }

  // render

  if (!allMappingCategories || allMappingCategories.length === 0) return null;

  return (
    <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: currentCategories.length > 0 ? 1 : 0,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Tags
        </Typography>
        <IconButton size="small" onClick={() => setDialogOpen(true)}>
          <Add fontSize="small" />
        </IconButton>
      </Box>

      {currentCategories.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {currentCategories.map((cat) => (
            <Chip
              key={cat}
              label={resolveLabel(cat)}
              size="small"
              onDelete={() => handleDelete(cat)}
            />
          ))}
        </Box>
      )}

      <DialogAddMappingCategories
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        allMappingCategories={allMappingCategories}
        currentCategories={currentCategories}
        onAdd={handleAdd}
      />
    </WhiteSectionGeneric>
  );
}
