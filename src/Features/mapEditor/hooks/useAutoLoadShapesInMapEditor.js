import {useEffect} from "react";

import useShapes from "Features/shapes/hooks/useShapes";
import parseShapeForMapEditor from "../utils/parseShapeForMapEditor";

export default function useAutoLoadShapesInMapEditor({
  mapEditor,
  mapEditorIsReady,
}) {
  const shapes = useShapes({widthSelected: true});

  const items = shapes.map(parseShapeForMapEditor);

  useEffect(() => {
    if (mapEditorIsReady) {
      mapEditor.loadShapes(items);
    }
  }, [mapEditorIsReady, items.length]);
}
