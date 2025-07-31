import useOpenCreateItemPanel from "../hooks/useOpenCreateItemPanel";

import ListPanelCreateItem from "./ListPanelCreateItem";

export default function ListPanelsContainer() {
  // data

  const openCreateItemPanel = useOpenCreateItemPanel();

  console.log("[openCreateItemPanel]", openCreateItemPanel);

  return <>{openCreateItemPanel && <ListPanelCreateItem />}</>;
}
