import {useSelector} from "react-redux";

export default function useShapes(options) {
  // options

  const filterByMapId = options?.filterByMapId;
  const withMap = options?.withMap;
  const withSelected = options?.withSelected;

  // data

  const shapesMap = useSelector((state) => state.shapes.shapesMap);
  const selectedShapeId = useSelector((s) => s.shapes.selectedShapeId);
  const mapsMap = useSelector((state) => state.maps.mapsMap);

  // helpers

  let shapes = Object.values(shapesMap);

  // options

  if (filterByMapId) {
    shapes = shapes.filter((shape) => shape.mapId === filterByMapId);
  }

  if (withMap) {
    shapes = shapes.map((shape) => ({
      ...shape,
      map: mapsMap[shape.mapId],
    }));
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
