import { useDispatch, useSelector } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import useBaseMaps from "../hooks/useBaseMaps";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderListPanel from "Features/listPanel/components/HeaderListPanel";
import useSelectedListType from "Features/listPanel/hooks/useSelectedListType";
import ListBaseMapsV2 from "./ListBaseMapsV2";
import ButtonCreateBaseMap from "./ButtonCreateBaseMap";
import SectionCreateBaseMap from "./SectionCreateBaseMap";

export default function SectionBaseMapsInListPanel() {
  const dispatch = useDispatch();

  // strings

  const createS = "Créer un fond de plan";

  // data

  const listType = useSelectedListType();
  const { value: baseMaps } = useBaseMaps();
  const isCreating = useSelector((s) => s.baseMaps.isCreatingBaseMap);

  console.log("baseMaps", baseMaps);

  // handlers

  function handleBaseMapClick(bm) {
    //dispatch(setSelectedMainBaseMapId(bm.id));
  }

  function handleSelectInEditor(bm) {
    dispatch(setSelectedMainBaseMapId(bm.id));
  }

  if (isCreating) return <SectionCreateBaseMap />;

  return (
    <BoxFlexVStretch>
      <HeaderListPanel
        title={listType?.label}
        actionComponent={<ButtonCreateBaseMap />}
      />
      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <ListBaseMapsV2
          baseMaps={baseMaps}
          onClick={handleBaseMapClick}
          onSelectInEditor={handleSelectInEditor}
        />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
