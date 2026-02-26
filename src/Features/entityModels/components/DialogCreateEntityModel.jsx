import { useState } from "react";
import { useSelector } from "react-redux";

import {
  Box,
  Button,
  MenuItem,
  TextField,
} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import useCreateEntityModel from "../hooks/useCreateEntityModel";

const ENTITY_MODEL_TYPES = [
  { key: "LOCATED_ENTITY", label: "Located entity" },
  { key: "BASE_MAP", label: "Base map" },
  { key: "BLUEPRINT", label: "Blueprint" },
];

export default function DialogCreateEntityModel({ open, onClose }) {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const create = useCreateEntityModel();

  // state

  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("LOCATED_ENTITY");

  // handlers

  async function handleCreate() {
    if (!key || !name) return;
    await create({
      projectId,
      key,
      name,
      type,
      defaultTable: "entities",
      defaultColor: "#FF9800",
      defaultIconKey: "annotation",
      fieldsObject: {},
    });
    setKey("");
    setName("");
    setType("LOCATED_ENTITY");
    onClose();
  }

  // render

  return (
    <DialogGeneric open={open} onClose={onClose} title="New entity model" width="350px">
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2 }}>
        <TextField
          label="Key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          size="small"
          select
          fullWidth
        >
          {ENTITY_MODEL_TYPES.map((t) => (
            <MenuItem key={t.key} value={t.key}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!key || !name}
          fullWidth
        >
          Create
        </Button>
      </Box>
    </DialogGeneric>
  );
}
