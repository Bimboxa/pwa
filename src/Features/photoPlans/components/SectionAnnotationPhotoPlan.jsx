import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import { triggerPhotoPlansUpdate } from "../photoPlansSlice";

import {
  Box,
  Button,
  IconButton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import db from "App/db/db";

import useBaseMap from "Features/baseMaps/hooks/useBaseMap";
import usePhotoPlanByAnnotation from "../hooks/usePhotoPlanByAnnotation";
import useCreatePhotoPlan from "../hooks/useCreatePhotoPlan";

// "Plan photo" section of the annotation properties panel: promotes a POLYGON
// drawn on a photo baseMap (BASE_MAPS module) to a photoPlan record, then
// edits it (name / real-world plane orientation / delete). Self-hiding.
export default function SectionAnnotationPhotoPlan({ annotation }) {
  const dispatch = useDispatch();

  // data

  const baseMap = useBaseMap({ id: annotation?.baseMapId });
  const { value: photoPlan } = usePhotoPlanByAnnotation({
    annotationId: annotation?.id,
  });
  const createPhotoPlan = useCreatePhotoPlan();

  // state

  const [name, setName] = useState("");
  const [draftOrientation, setDraftOrientation] = useState("VERTICAL");
  const orientation = photoPlan?.orientation ?? draftOrientation;

  useEffect(() => {
    setName(photoPlan?.name ?? "");
  }, [photoPlan?.id, annotation?.id]);

  // handlers

  async function handleCreate() {
    if (!name) return;
    await createPhotoPlan({ annotation, name, orientation });
  }

  async function handleOrientationChange(value) {
    if (!value) return;
    if (!photoPlan) {
      setDraftOrientation(value);
      return;
    }
    await db.photoPlans.update(photoPlan.id, { orientation: value });
    dispatch(triggerPhotoPlansUpdate());
  }

  async function handleNameBlur() {
    if (!photoPlan || !name || name === photoPlan.name) return;
    await db.photoPlans.update(photoPlan.id, { name });
    dispatch(triggerPhotoPlansUpdate());
  }

  async function handleDelete() {
    if (!photoPlan) return;
    await db.photoPlans.delete(photoPlan.id); // soft-delete middleware
    dispatch(triggerPhotoPlansUpdate());
    setName("");
  }

  // render

  if (annotation?.type !== "POLYGON" || !baseMap?.isPhoto) return null;

  const calibrated = Boolean(photoPlan?.calibration?.ok);

  return (
    <Box sx={{ p: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Plan photo
        </Typography>
        {photoPlan && (
          <Tooltip title="Supprimer le plan photo">
            <IconButton size="small" onClick={handleDelete}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box
        sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 0.5 }}
      >
        <TextField
          size="small"
          placeholder="Nom du plan (ex. Façade sud)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
        />

        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={orientation}
          onChange={(_e, v) => handleOrientationChange(v)}
        >
          <ToggleButton
            value="HORIZONTAL"
            sx={{ textTransform: "none", py: 0.25 }}
          >
            Horizontal
          </ToggleButton>
          <ToggleButton
            value="VERTICAL"
            sx={{ textTransform: "none", py: 0.25 }}
          >
            Vertical
          </ToggleButton>
        </ToggleButtonGroup>

        {!photoPlan ? (
          <Button
            variant="contained"
            size="small"
            disabled={!name}
            onClick={handleCreate}
            sx={{ textTransform: "none", alignSelf: "flex-end", px: 2 }}
          >
            Créer
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {calibrated
              ? `Calibré le ${new Date(
                  photoPlan.calibration.computedAt
                ).toLocaleDateString()}`
              : "Non calibré — utilisez l'outil Élévation du module Fonds de plan."}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
