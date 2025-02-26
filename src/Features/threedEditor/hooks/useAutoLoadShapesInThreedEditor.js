import {useEffect} from "react";

import useShapes from "Features/shapes/hooks/useShapes";

export default function useAutoLoadShapesInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const shapes = useShapes({widthSelected: true, withMap: true});

  useEffect(() => {
    if (threedEditor?.loadShapes) {
      threedEditor.loadShapes(shapes);
    }
  }, [rendererIsReady, shapes.length]);
}
