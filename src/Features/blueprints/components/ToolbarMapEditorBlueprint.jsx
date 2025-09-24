import { useState, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setNewEntity,
  setEditedEntity,
  setIsEditingEntity,
} from "Features/entities/entitiesSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";

import useEntity from "Features/entities/hooks/useEntity";
import useSaveEntity from "Features/entities/hooks/useSaveEntity";

import { Box, Typography, TextField } from "@mui/material";
import { Add, Refresh } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";

export default function ToolbarMapEditorBlueprint({ svgElement }) {
  const dispatch = useDispatch();

  // strings

  const createS = "Créer";
  const updateS = "Mettre à jour";
  const placeholder = "Nom du plan";

  // state

  const tempName = useSelector((s) => s.blueprints.tempName);
  const [name, setName] = useState("");

  useEffect(() => {
    if (tempName) setName(tempName);
  }, [tempName]);

  // data

  const entity = useEntity();

  const newEntity = useSelector((s) => s.entities.newEntity);
  const editedEntity = useSelector((s) => s.entities.editedEntity);

  const baseMapPoseInBg = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const bgImageKey = useSelector((s) => s.bgImage.bgImageKeyInMapEditor);
  const legendFormat = useSelector((s) => s.mapEditor.legendFormat);
  const bgImageRawTextAnnotations = useSelector(
    (s) => s.mapEditor.bgImageRawTextAnnotations
  );

  // data - func

  const [saveEntity] = useSaveEntity();

  // helpers

  const mode = entity?.id ? "UPDATE" : "CREATE";

  // handlers

  async function handleCreateClick() {
    console.log("create");
    const blob = await getImageFromSvg(svgElement);
    const file = new File([blob], "plan.png", { type: "image/png" });
    const _newEntity = {
      ...newEntity,
      image: { file, imageUrlClient: URL.createObjectURL(blob) },
      name,
      baseMapPoseInBg,
      baseMapId,
      bgImageKey,
      legendFormat,
      bgImageRawTextAnnotations,
    };

    await saveEntity(_newEntity, { updateSyncFile: true });
  }

  async function handleUpdateClick() {
    const blob = await getImageFromSvg(svgElement);
    const file = new File([blob], "plan.png", { type: "image/png" });
    const _editedEntity = {
      ...entity,
      image: { file, imageUrlClient: URL.createObjectURL(blob) },
      baseMapPoseInBg,
      bgImageKey,
      legendFormat,
      baseMapId,
      bgImageRawTextAnnotations,
    };

    await saveEntity(_editedEntity, { updateSyncFile: true });
  }

  return (
    <>
      {mode === "CREATE" && (
        <Box
          sx={{
            display: "flex",
            p: 0.5,
            pr: 1,
            alignItems: "center",
            borderRadius: "8px",
            bgcolor: "white",
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            placeholder={placeholder}
          />
          <Box sx={{ ml: 1 }}>
            <ButtonGeneric
              label={createS}
              onClick={handleCreateClick}
              variant="contained"
              startIcon={<Add />}
              disabled={!name.length > 0}
            />
          </Box>
        </Box>
      )}

      {mode === "UPDATE" && (
        <Box
          sx={{
            display: "flex",
            p: 0.5,
            pl: 1,
            alignItems: "center",
            borderRadius: "8px",
            bgcolor: "white",
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body2" sx={{ mr: 2 }}>
            {entity.name}
          </Typography>
          <ButtonGeneric
            label={updateS}
            onClick={handleUpdateClick}
            variant="contained"
            startIcon={<Refresh />}
          />
        </Box>
      )}
    </>
  );
}
