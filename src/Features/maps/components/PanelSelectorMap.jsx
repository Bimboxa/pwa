import useMaps from "../hooks/useMaps";
import ListMaps from "./ListMaps";

export default function PanelSelectorMap({onSelectionChange, selection}) {
  // data

  const {value: items} = useMaps();
  console.log("[SelectorMap] maps", items);

  // handler

  function handleClick(map) {
    console.log("map", map);
    onSelectionChange(map.id);
  }

  function handleCreateClick() {
    console.log("create");
  }

  return (
    <ListMaps
      maps={items}
      selection={selection ? [selection] : []}
      onClick={handleClick}
      //onCreateClick={handleCreateClick}
    />
  );
}
