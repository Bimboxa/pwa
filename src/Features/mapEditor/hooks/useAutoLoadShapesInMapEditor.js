import { useEffect } from "react";

import { useSelector } from "react-redux";

import useShapes from "Features/shapes/hooks/useShapes";
import parseShapeForMapEditor from "../utils/parseShapeForMapEditor";

export default function useAutoLoadShapesInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const loadedMainBaseMapId = useSelector(
    (s) => s.mapEditor.loadedMainBaseMapId
  );

  const shapes = useShapes({
    withSelected: true,
    filterByMapId: loadedMainBaseMapId,
  });

  useEffect(() => {
    if (mapEditorIsReady && loadedMainBaseMapId) {
      console.log("useAutoLoadShapesInMapEditor", shapes);
      mapEditor.loadShapes(shapes);
    }
  }, [mapEditorIsReady, shapes.length, loadedMainBaseMapId]);
}
