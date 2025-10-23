import { useDispatch, useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import SelectorVariantChips from "Features/layout/components/SelectorVariantChips";
import { setFilterByMainBaseMap } from "Features/mapEditor/mapEditorSlice";

export default function SectionFilterEntitiesByMainBaseMap() {
  const dispatch = useDispatch();

  // strings

  const allS = "Tout afficher";

  // data

  const mainBaseMap = useMainBaseMap();
  const filterByMainBaseMap = useSelector(
    (s) => s.mapEditor.filterByMainBaseMap
  );

  // helpers

  const options = [
    { key: "BASE_MAP", label: mainBaseMap?.name },
    { key: "ALL", label: allS },
  ];
  const selection = filterByMainBaseMap ? ["BASE_MAP"] : ["ALL"];

  // handlers

  function handleChange(optionKeys) {
    console.log("optionKeys", optionKeys);
    dispatch(setFilterByMainBaseMap(optionKeys?.[0] === "BASE_MAP"));
  }

  // render

  return (
    <SelectorVariantChips
      options={options}
      selection={selection}
      onChange={handleChange}
    />
  );
}
