import { useState, useEffect } from "react";

import {
  Box,
  Typography,
  Button,
  Checkbox,
  FormControlLabel,
} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";

export default function DialogAddMappingCategories({
  open,
  onClose,
  allMappingCategories,
  currentCategories,
  onAdd,
}) {
  // state

  const [selected, setSelected] = useState([]);

  // helpers

  const currentSet = new Set(currentCategories);

  // handlers

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  function handleToggle(categoryString) {
    setSelected((prev) =>
      prev.includes(categoryString)
        ? prev.filter((c) => c !== categoryString)
        : [...prev, categoryString]
    );
  }

  function handleAdd() {
    onAdd(selected);
    onClose();
  }

  // render

  return (
    <DialogGeneric
      open={open}
      onClose={onClose}
      title="Ajouter des tags"
      width={350}
    >
      <Box sx={{ p: 2, overflow: "auto", flex: 1 }}>
        {allMappingCategories?.map((nomenclature) => (
          <Box key={nomenclature.nomenclature.key} sx={{ mb: 2 }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: "bold", mb: 0.5 }}
            >
              {nomenclature.nomenclature.label}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", pl: 1 }}>
              {nomenclature.categories.map((category) => {
                const key = `${nomenclature.nomenclature.key}:${category.key}`;
                const alreadyAssigned = currentSet.has(key);
                const isSelected = selected.includes(key);

                return (
                  <FormControlLabel
                    key={key}
                    control={
                      <Checkbox
                        size="small"
                        checked={alreadyAssigned || isSelected}
                        disabled={alreadyAssigned}
                        onChange={() => handleToggle(key)}
                      />
                    }
                    label={
                      <Typography variant="body2">{category.label}</Typography>
                    }
                  />
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", p: 2, pt: 0 }}>
        <Button
          variant="contained"
          size="small"
          onClick={handleAdd}
          disabled={selected.length === 0}
        >
          Ajouter
        </Button>
      </Box>
    </DialogGeneric>
  );
}
