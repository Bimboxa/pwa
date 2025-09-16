import { useDispatch, useSelector } from "react-redux";

import { setNewEntity, setEditedEntity } from "Features/entities/entitiesSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";

import { Box } from "@mui/material";
import { Add, Refresh } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";

export default function ToolbarMapEditorBlueprint({ svgElement }) {
  const dispatch = useDispatch();

  // strings

  const createS = "Nouveau plan";
  const updateS = "Mettre à jour";

  // data

  const newEntity = useSelector((s) => s.entities.newEntity);
  const editedEntity = useSelector((s) => s.entities.editedEntity);

  const baseMapPoseInBg = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const bgImageKey = useSelector((s) => s.bgImage.bgImageKeyInMapEditor);

  // handlers

  async function handleCreateClick() {
    console.log("create");
    const blob = await getImageFromSvg(svgElement);
    const file = new File([blob], "plan.png", { type: "image/png" });
    const _newEntity = {
      ...newEntity,
      image: { file, imageUrlClient: URL.createObjectURL(blob) },
      name: "Nouveau plan",
      baseMapPoseInBg,
      baseMapId,
      bgImageKey,
    };

    dispatch(setNewEntity(_newEntity));
  }

  async function handleUpdateClick() {
    const blob = await getImageFromSvg(svgElement);
    const file = new File([blob], "plan.png", { type: "image/png" });
    const _editedEntity = {
      ...editedEntity,
      image: { file, imageUrlClient: URL.createObjectURL(blob) },
      name: "Nouveau plan v2",
      baseMapPoseInBg,
      bgImageKey,
    };

    dispatch(setEditedEntity(_editedEntity));
  }

  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <ButtonGeneric
        label={createS}
        onClick={handleCreateClick}
        variant="contained"
        startIcon={<Add />}
      />
      <ButtonGeneric
        label={updateS}
        onClick={handleUpdateClick}
        variant="contained"
        startIcon={<Refresh />}
      />
    </Box>
  );
}
