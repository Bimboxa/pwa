import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setOpencvClickMode } from "../opencvSlice";

export default function ButtonGetHorizontalAndVerticalLines() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const enabledDrawingMode = useSelector(
    (state) => state.mapEditor.enabledDrawingMode
  );
  const opencvClickMode = useSelector((state) => state.opencv.opencvClickMode);

  const handleClick = () => {
    setLoading(true);
    dispatch(setOpencvClickMode("GET_ORTHO_LINES"));
    dispatch(setEnabledDrawingMode("OPENCV"));
  };

  useEffect(() => {
    if (
      enabledDrawingMode !== "OPENCV" ||
      opencvClickMode !== "GET_ORTHO_LINES"
    ) {
      setLoading(false);
    }
  }, [enabledDrawingMode, opencvClickMode]);

  return (
    <ButtonActionInPanel
      label="Détecter les murs"
      onClick={handleClick}
      loading={loading}
      variant="contained"
      color="action"
    />
  );
}

