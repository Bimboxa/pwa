import useMaps from "../hooks/useMaps";
import ListMaps from "./ListMaps";

export default function PanelSelectorMap() {
  // data

  const {value: items} = useMaps();
  console.log("items", items);

  // handler

  function handleClick() {
    console.log("map");
  }

  function handleCreateClick() {
    console.log("create");
  }

  return (
    <ListMaps
      maps={items}
      onClick={handleClick}
      onCreateClick={handleCreateClick}
    />
  );
}
