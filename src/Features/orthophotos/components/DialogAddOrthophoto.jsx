import { useRef, useState } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";

import getImageSizeAsync from "Features/images/utils/getImageSizeAsync";
import {
  addOrthophotosService,
  getNextOrthophotoName,
} from "../services/orthophotoServices";
import { getDefaultOrthophotoCorners } from "../utils/getOrthophotoPlacement";

function FilePicker({ label, hint, file, onChange }) {
  // state

  const inputRef = useRef(null);

  // render

  return (
    <Box
      onClick={() => inputRef.current?.click()}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: 1,
        border: "1.5px dashed",
        borderColor: file ? "primary.main" : "divider",
        cursor: "pointer",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <AddPhotoAlternateOutlined color={file ? "primary" : "disabled"} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {file?.name ?? hint}
        </Typography>
      </Box>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </Box>
  );
}

// Adds ONE unit orthophoto by hand: its rectified image (required) and its
// original photo. The orthophoto lands centred on the base map (a third of
// its width) with its station at the centre — both are then adjusted on the
// plan from the Orthophotos tool.
export default function DialogAddOrthophoto({
  open,
  onClose,
  baseMap,
  orthophotos,
  onAdded,
}) {
  // strings

  const titleS = "Ajouter une orthophoto";
  const nameS = "Nom de la station";
  const orthoS = "Orthophoto rectifiée";
  const orthoHintS = "Image vue de dessus, redressée (PNG / JPEG)";
  const sourceS = "Image d'origine";
  const sourceHintS = "Photo brute de la prise de vue (optionnelle)";
  const cancelS = "Annuler";
  const addS = "Ajouter";

  // state

  const [name, setName] = useState("");
  const [orthoFile, setOrthoFile] = useState(null);
  const [sourceFile, setSourceFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // helpers

  const defaultName = getNextOrthophotoName(orthophotos);

  // handlers

  function handleClose() {
    if (saving) return;
    setName("");
    setOrthoFile(null);
    setSourceFile(null);
    onClose();
  }

  async function handleAdd() {
    if (!orthoFile || saving) return;
    setSaving(true);
    try {
      const url = URL.createObjectURL(orthoFile);
      let imageSize;
      try {
        imageSize = await getImageSizeAsync(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const [row] = await addOrthophotosService({
        baseMap: {
          id: baseMap.id,
          projectId: baseMap.projectId,
          listingId: baseMap.listingId,
        },
        items: [
          {
            name: name.trim() || defaultName,
            orthoFile,
            sourceFile,
            station: { x: 0.5, y: 0.5 },
            corners: getDefaultOrthophotoCorners({
              baseMapSize: baseMap.getImageSize?.(),
              imageSize,
            }),
          },
        ],
      });
      setName("");
      setOrthoFile(null);
      setSourceFile(null);
      onAdded?.(row);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // render

  if (!open) return null;

  return (
    <Dialog open onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
      >
        <TextField
          size="small"
          label={nameS}
          value={name}
          placeholder={defaultName}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 1 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FilePicker
          label={orthoS}
          hint={orthoHintS}
          file={orthoFile}
          onChange={setOrthoFile}
        />
        <FilePicker
          label={sourceS}
          hint={sourceHintS}
          file={sourceFile}
          onChange={setSourceFile}
        />
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={handleClose} disabled={saving}>
          {cancelS}
        </Button>
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={!orthoFile || saving}
        >
          {addS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
