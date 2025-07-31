import { useSelector } from "react-redux";

export default function useOpenCreateItemPanel() {
  // data

  const isCreatingBaseMapView = useSelector(
    (s) => s.baseMapViews.isCreatingBaseMapView
  );
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helper

  const test = Boolean(enabledDrawingMode);

  return test;
}
