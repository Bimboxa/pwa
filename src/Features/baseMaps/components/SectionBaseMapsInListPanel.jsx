import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import useBaseMaps from "../hooks/useBaseMaps";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderListPanel from "Features/listPanel/components/HeaderListPanel";
import useSelectedListType from "Features/listPanel/hooks/useSelectedListType";
import ListBaseMapsV2 from "./ListBaseMapsV2";

export default function SectionBaseMapsInListPanel() {
  const dispatch = useDispatch();

  // data

  const listType = useSelectedListType();
  const { value: baseMaps } = useBaseMaps();

  // handlers

  function handleBaseMapClick(bm) {
    dispatch(setSelectedMainBaseMapId(bm.id));
  }

  return (
    <BoxFlexVStretch>
      <HeaderListPanel title={listType?.label} />
      <ListBaseMapsV2 baseMaps={baseMaps} onClick={handleBaseMapClick} />
    </BoxFlexVStretch>
  );
}
