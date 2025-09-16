import { useDispatch, useSelector } from "react-redux";

import {
  setNewEntity,
  setSelectedEntityId,
} from "Features/entities/entitiesSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import { Add } from "@mui/icons-material";

import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";

export default function ToolbarMapEditorBlueprint({ svgElement }) {
  const dispatch = useDispatch();

  // strings

  const createS = "Nouveau plan";
  const updateS = "Mettre à jour";

  // data

  const newEntity = useSelector((s) => s.entities.newEntity);
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

  return (
    <ButtonGeneric
      label={createS}
      onClick={handleCreateClick}
      variant="contained"
      startIcon={<Add />}
    />
  );
}
