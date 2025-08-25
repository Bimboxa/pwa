import useOpenCreateItemPanel from "../hooks/useOpenCreateItemPanel";
import { useSelector } from "react-redux";

import Panel from "Features/layout/components/Panel";
import ListPanelV2 from "./ListPanelV2";
import ListPanelCreateItem from "./ListPanelCreateItem";
import ListPanelClickedItem from "./ListPanelClickedItem";

export default function ListPanelsContainer() {
  // data

  const openCreate = useOpenCreateItemPanel();
  const selectedListTypeKey = useSelector(
    (s) => s.listPanel.selectedListTypeKey
  );
  const clickedItem = useSelector((s) => s.listPanel.clickedItem);

  // helper

  let openList = Boolean(selectedListTypeKey) && !openCreate;

  return (
    <Panel sx={{ position: "relative" }}>
      <Panel sx={{ visibility: clickedItem ? "hidden" : "visible" }}>
        {openList && <ListPanelV2 />}
        {openCreate && <ListPanelCreateItem />}
      </Panel>
      {clickedItem && <ListPanelClickedItem />}
    </Panel>
  );
}
