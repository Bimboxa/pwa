import {useDispatch, useSelector} from "react-redux";

import {setNewShape, setEditedShape, updateShape} from "../shapesSlice";

export default function useUpdateShapeInForm() {
  const dispatch = useDispatch();

  const isEditingShape = useSelector((s) => s.shapes.isEditingShape);

  function updateShapeInForm(shape) {
    if (isEditingShape) {
      dispatch(setEditedShape(shape));
    } else {
      if (!shape.id) {
        dispatch(setNewShape(shape));
      } else {
        dispatch(updateShape(shape));
      }
    }
  }

  return updateShapeInForm;
}
