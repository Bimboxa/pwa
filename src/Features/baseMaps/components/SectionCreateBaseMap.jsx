import { useSelector, useDispatch } from "react-redux";

import { setEditedBaseMap, setIsCreatingBaseMap } from "../baseMapsSlice";

import useCreateBaseMap from "../hooks/useCreateBaseMap";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderListPanel from "Features/listPanel/components/HeaderListPanel";
import FormBaseMapVariantCreate from "./FormBaseMapVariantCreate";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import IconButtonClose from "Features/layout/components/IconButtonClose";

export default function SectionCreateBaseMap() {
  const dispatch = useDispatch();

  // strings

  const title = "Nouveau fond de plan";
  const createS = "Créer";

  // data

  const baseMap = useSelector((s) => s.baseMaps.editedBaseMap);
  const createBaseMap = useCreateBaseMap();

  // handler

  function handleBaseMapChange(bm) {
    console.log("change bm", bm);
    dispatch(setEditedBaseMap(bm));
  }

  async function handleCreateClick() {
    console.log("editedBaseMap", baseMap);
    await createBaseMap(baseMap);
    dispatch(setEditedBaseMap(null));
    dispatch(setIsCreatingBaseMap(false));
  }

  function handleClose() {
    console.log("closing");
    dispatch(setIsCreatingBaseMap(false));
  }

  return (
    <BoxFlexVStretch>
      <HeaderListPanel
        title={title}
        actionComponent={<IconButtonClose onClose={handleClose} />}
      />
      <FormBaseMapVariantCreate
        baseMap={baseMap}
        onChange={handleBaseMapChange}
      />
      <ButtonInPanelV2
        label={createS}
        onClick={handleCreateClick}
        color="secondary"
        variant="contained"
      />
    </BoxFlexVStretch>
  );
}
