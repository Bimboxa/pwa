import { setSelectedEntityId } from "Features/entities/entitiesSlice";
import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import { useDispatch } from "react-redux";

export default function useResetSelection() {
  const dispatch = useDispatch();

  return () => {
    dispatch(setSelectedNode(null));
    dispatch(setSelectedEntityId(null));
  };
}
