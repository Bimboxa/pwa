import {useSelector} from "react-redux";

export default function useShapes(options) {
  // options

  const filterByMapId = options?.filterByMapId;
  const withSelected = options?.withSelected;

  // data

  const shapesMap = useSelector((state) => state.shapes.shapesMap);
  const selectedShapeId = useSelector((s) => s.shapes.selectedShapeId);

  // helpers

  let shapes = Object.values(shapesMap);

  // options

  if (filterByMapId) {
    shapes = shapes.filter((shape) => shape.mapId === filterByMapId);
  }

  if (withSelected) {
    shapes = shapes.map((shape) => ({
      ...shape,
      selected: selectedShapeId === shape.id,
    }));
  }

  // return

  return shapes;
}
