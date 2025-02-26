import {useSelector} from "react-redux";
import useSelectedShape from "./useSelectedShape";

export default function useShapeInForm() {
  const newShape = useSelector((s) => s.shapes.newShape);
  const editedShape = useSelector((s) => s.shapes.editedShape);
  const isEditingShape = useSelector((s) => s.shapes.isEditing);

  const selectedShape = useSelectedShape();

  let shape = selectedShape;

  if (isEditingShape) {
    shape = editedShape;
  } else {
    if (!shape) {
      shape = newShape;
    }
  }

  return shape;
}
