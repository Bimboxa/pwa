import useOpenCreateItemPanel from "../hooks/useOpenCreateItemPanel";
import { useSelector } from "react-redux";

import Panel from "Features/layout/components/Panel";
import ListPanelV2 from "./ListPanelV2";
import ListPanelCreateItem from "./ListPanelCreateItem";

export default function ListPanelsContainer() {
  // data

  const openCreate = useOpenCreateItemPanel();
  const selectedListTypeKey = useSelector(
    (s) => s.listPanel.selectedListTypeKey
  );

  // helper

  let openList = Boolean(selectedListTypeKey) && !openCreate;

  return (
    <Panel>
      {openList && <ListPanelV2 />}
      {openCreate && <ListPanelCreateItem />}
    </Panel>
  );
}
