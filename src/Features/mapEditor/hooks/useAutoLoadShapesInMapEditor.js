import {useEffect} from "react";

import {useSelector} from "react-redux";

import useShapes from "Features/shapes/hooks/useShapes";
import parseShapeForMapEditor from "../utils/parseShapeForMapEditor";

export default function useAutoLoadShapesInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const loadedMainMapId = useSelector((s) => s.mapEditor.loadedMainMapId);

  const shapes = useShapes({
    withSelected: true,
    filterByMapId: loadedMainMapId,
  });

  useEffect(() => {
    if (mapEditorIsReady && loadedMainMapId) {
      console.log("useAutoLoadShapesInMapEditor", shapes);
      mapEditor.loadShapes(shapes);
    }
  }, [mapEditorIsReady, shapes.length, loadedMainMapId]);
}
