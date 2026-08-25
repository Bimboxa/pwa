import { useDispatch, useSelector } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import useBaseMaps from "../hooks/useBaseMaps";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderListPanel from "Features/listPanel/components/HeaderListPanel";
import useSelectedListType from "Features/listPanel/hooks/useSelectedListType";
import ListBaseMapsV2 from "./ListBaseMapsV2";
import ButtonCreateBaseMap from "./ButtonCreateBaseMap";
import SectionCreateBaseMap from "./SectionCreateBaseMap";
import ItemsInListPanelGeneric from "Features/listPanel/components/ItemsInListPanelGeneric";
import ListItemBaseMap from "./ListItemBaseMap";

export default function SectionBaseMapsInListPanel() {
  const dispatch = useDispatch();

  // strings

  const createS = "Créer un fond de plan";

  // data

  const listType = useSelectedListType();
  const { value: baseMaps } = useBaseMaps();
  const isCreating = useSelector((s) => s.baseMaps.isCreatingBaseMap);
  const selectedId = useSelector((s) => s.baseMapViews.selectedBaseMapId);

  console.log("baseMaps", baseMaps);

  // helpers

  const selection = selectedId ? [selectedId] : [];

  // handlers

  function handleBaseMapClick(bm) {
    //dispatch(setSelectedMainBaseMapId(bm.id));
  }

  function handleSelectInEditor(bm) {
    dispatch(setSelectedMainBaseMapId(bm.id));
  }

  function handleCreateClick() {
    const selectedId = useSelector((s) => s.baseMapViews.selectedBaseMapViewId);
  }

  if (isCreating) return <SectionCreateBaseMap />;

  return (
    <BoxFlexVStretch>
      <ItemsInListPanelGeneric
        title="Fonds de plan"
        items={(baseMaps ?? []).filter(
          // Photos replaced by their "mise à plat" counterpart are hidden
          // (props toggle "Photo d'origine / Mise à plat" reaches them).
          (bm) =>
            !(
              bm.isPhoto &&
              bm.flattenedBaseMapId &&
              baseMaps.some((o) => o.id === bm.flattenedBaseMapId)
            )
        )}
        searchKeys={["name"]}
        onItemClick={handleBaseMapClick}
        onCreateClick={handleCreateClick}
        selection={selection}
        componentListItem={ListItemBaseMap}
      />
      {/* <HeaderListPanel
        title={listType?.label}
        actionComponent={<ButtonCreateBaseMap />}
      />
      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <ListBaseMapsV2
          baseMaps={baseMaps}
          onClick={handleBaseMapClick}
          onSelectInEditor={handleSelectInEditor}
        />
      </BoxFlexVStretch> */}
    </BoxFlexVStretch>
  );
}
