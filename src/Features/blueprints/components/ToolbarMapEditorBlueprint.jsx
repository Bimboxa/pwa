import { useState, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setNewEntity,
  setEditedEntity,
  setIsEditingEntity,
  setSelectedEntityId,
} from "Features/entities/entitiesSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";
import { setBlueprintIdInMapEditor } from "../blueprintsSlice";

import useEntity from "Features/entities/hooks/useEntity";
import useSaveEntity from "Features/entities/hooks/useSaveEntity";

import useBlueprints from "../hooks/useBlueprints";
import useBlueprintInMapEditor from "../hooks/useBlueprintInMapEditor";

import { Box, Typography, TextField } from "@mui/material";
import { Add, Refresh } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import ButtonSelectorBlueprintInMapEditor from "./ButtonSelectorBlueprintInMapEditor";

import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";

export default function ToolbarMapEditorBlueprint({ svgElement }) {
  const dispatch = useDispatch();

  // strings

  const createS = "Créer";
  const updateS = "Mettre à jour";
  const placeholder = "Nom de l'export";
  const blueprintS = "Export";

  // state - new

  const [openNew, setOpenNew] = useState(false);

  // state

  const tempName = useSelector((s) => s.blueprints.tempName);
  const [name, setName] = useState("");

  useEffect(() => {
    if (tempName) setName(tempName);
  }, [tempName]);

  // data

  const entity = useEntity();

  const newEntity = useSelector((s) => s.entities.newEntity);

  const baseMapPoseInBg = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMapGrayScale = useSelector((s) => s.mapEditor.baseMapGrayScale);
  const baseMapOpacity = useSelector((s) => s.mapEditor.baseMapOpacity);

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const bgImageKey = useSelector((s) => s.bgImage.bgImageKeyInMapEditor);
  const legendFormat = useSelector((s) => s.mapEditor.legendFormat);
  const bgImageRawTextAnnotations = useSelector(
    (s) => s.bgImage.bgImageRawTextAnnotations
  );

  const blueprints = useBlueprints();
  const blueprint = useBlueprintInMapEditor();

  // data - func

  const [saveEntity] = useSaveEntity();

  // helpers

  const showCreate = openNew || !blueprints?.length > 0;

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
      baseMapGrayScale,
      baseMapOpacity,
      baseMapId,
      bgImageKey,
      legendFormat,
      bgImageRawTextAnnotations,
    };

    const result = await saveEntity(_newEntity, { updateSyncFile: true });
    dispatch(setSelectedEntityId(result.id));
    dispatch(setIsEditingEntity(false));
    dispatch(setEditedEntity(null));

    dispatch(setBlueprintIdInMapEditor(result.id));

    //
    setName("");
    setOpenNew(false);
  }

  async function handleUpdateClick() {
    const blob = await getImageFromSvg(svgElement);
    const file = new File([blob], "plan.png", { type: "image/png" });
    const _editedEntity = {
      ...blueprint,
      image: { file, imageUrlClient: URL.createObjectURL(blob) },
      baseMapPoseInBg,
      baseMapGrayScale,
      baseMapOpacity,
      bgImageKey,
      legendFormat,
      baseMapId,
      bgImageRawTextAnnotations,
    };

    await saveEntity(_editedEntity, { updateSyncFile: true });

    dispatch(setIsEditingEntity(false));
    dispatch(setEditedEntity(null));
  }

  return (
    <>
      {showCreate && (
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
          <IconButtonClose onClose={() => setOpenNew(false)} />
          <Box sx={{ width: "300px" }}>
            <TextField
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="small"
              placeholder={placeholder}
            />
          </Box>

          <Box sx={{ ml: 1 }}>
            <ButtonGeneric
              label={createS}
              onClick={handleCreateClick}
              variant="contained"
              color="secondary"
              startIcon={<Add />}
              disabled={!name.length > 0}
            />
          </Box>
        </Box>
      )}

      {!showCreate && (
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
          {/* <Typography variant="body2" sx={{ mr: 2 }}>
            {entity.name}
          </Typography> */}
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
            {blueprintS + ":"}
          </Typography>
          <ButtonSelectorBlueprintInMapEditor
            onCreateClick={() => setOpenNew(true)}
          />
          <ButtonGeneric
            sx={{ ml: 1 }}
            label={updateS}
            onClick={handleUpdateClick}
            variant="contained"
            startIcon={<Refresh />}
            disabled={!blueprint}
          />
        </Box>
      )}
    </>
  );
}
