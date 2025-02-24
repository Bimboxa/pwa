import {useEffect} from "react";

import useSelectedMap from "Features/maps/hooks/useSelectedMap";
import parseMapForMapEditor from "../utils/parseMapForMapEditor";

export default function useAutoLoadMainImageInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const selectedMap = useSelectedMap();

  const mainImage = parseMapForMapEditor(selectedMap, {nodeType: "MAIN_MAP"});
  console.log("[autoLoad]", selectedMap, mainImage);

  useEffect(() => {
    if (mapEditorIsReady && mainImage?.url) {
      mapEditor.loadMainImage(mainImage);
    }
  }, [mapEditorIsReady, mainImage?.url]);
}
