import { Box, Button, IconButton, Typography } from "@mui/material";
import { Add, ArrowUpward, ArrowDownward } from "@mui/icons-material";

import BlockFieldEditor from "./BlockFieldEditor";

export default function FieldsEditor({ fieldsObject, onChange }) {
  // helpers

  const entries = Object.entries(fieldsObject ?? {});

  // handlers

  function handleFieldChange(index, updatedField) {
    const newEntries = [...entries];
    newEntries[index] = [updatedField.key, updatedField];
    const newFieldsObject = Object.fromEntries(newEntries);
    onChange(newFieldsObject);
  }

  function handleFieldDelete(index) {
    const newEntries = entries.filter((_, i) => i !== index);
    const newFieldsObject = Object.fromEntries(newEntries);
    onChange(newFieldsObject);
  }

  function handleAdd() {
    const key = `field_${entries.length + 1}`;
    onChange({
      ...fieldsObject,
      [key]: { key, type: "text", label: "" },
    });
  }

  function handleReorder(index, direction) {
    const newEntries = [...entries];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newEntries.length) return;
    [newEntries[index], newEntries[targetIndex]] = [
      newEntries[targetIndex],
      newEntries[index],
    ];
    const newFieldsObject = Object.fromEntries(newEntries);
    onChange(newFieldsObject);
  }

  // render

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Fields
      </Typography>
      {entries.map(([key, field], index) => (
        <Box key={key} sx={{ display: "flex", alignItems: "center" }}>
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <IconButton
              size="small"
              onClick={() => handleReorder(index, -1)}
              disabled={index === 0}
            >
              <ArrowUpward sx={{ fontSize: "0.75rem" }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleReorder(index, 1)}
              disabled={index === entries.length - 1}
            >
              <ArrowDownward sx={{ fontSize: "0.75rem" }} />
            </IconButton>
          </Box>
          <BlockFieldEditor
            field={field}
            onChange={(updated) => handleFieldChange(index, updated)}
            onDelete={() => handleFieldDelete(index)}
          />
        </Box>
      ))}
      <Button size="small" startIcon={<Add />} onClick={handleAdd} sx={{ mt: 1 }}>
        Add field
      </Button>
    </Box>
  );
}
