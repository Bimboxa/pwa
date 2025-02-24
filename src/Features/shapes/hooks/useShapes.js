import {useSelector} from "react-redux";

export default function useShapes(options) {
  // data

  const shapesMap = useSelector((state) => state.shapes.shapesMap);

  const selectedShapeId = useSelector((s) => s.shapes.selectedShapeId);

  // helpers

  let shapes = Object.values(shapesMap);

  // options

  if (options.widthSelected) {
    shapes = shapes.map((shape) => ({
      ...shape,
      selected: selectedShapeId === shape.id,
    }));
  }

  // return

  return shapes;
}
