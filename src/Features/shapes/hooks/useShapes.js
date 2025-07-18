import { useSelector } from "react-redux";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function useShapes(options) {
  // options

  const filterByMapId = options?.filterByMapId;
  const withMap = options?.withMap;
  const withSelected = options?.withSelected;

  // data

  const shapesMap = useSelector((s) => s.shapes.shapesMap);
  const selectedShapeId = useSelector((s) => s.shapes.selectedShapeId);
  const baseMaps = useBaseMaps();

  // helpers

  const baseMapsById = getItemsByKey(baseMaps, "id");
  let shapes = Object.values(shapesMap);

  // options

  if (filterByMapId) {
    shapes = shapes.filter((shape) => shape.mapId === filterByMapId);
  }

  if (withMap) {
    shapes = shapes.map((shape) => ({
      ...shape,
      map: baseMapsById[shape.mapId],
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
