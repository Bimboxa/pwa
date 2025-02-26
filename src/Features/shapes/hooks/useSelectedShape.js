import {useSelector} from "react-redux";

export default function useSelectedShape() {
  const id = useSelector((s) => s.shapes.selectedShapeId);
  const shapesMap = useSelector((s) => s.shapes.shapesMap);
  return shapesMap[id];
}
