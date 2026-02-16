import { useDispatch } from "react-redux";
import { clearSelection } from "../selectionSlice";

export default function useResetSelection() {
  const dispatch = useDispatch();

  return () => {
    dispatch(clearSelection());
  };
}
