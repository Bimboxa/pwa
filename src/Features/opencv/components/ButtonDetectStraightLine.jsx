import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setOpencvClickMode } from "../opencvSlice";

export default function ButtonDetectStraightLine() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const enabledDrawingMode = useSelector(
    (state) => state.mapEditor.enabledDrawingMode
  );
  const opencvClickMode = useSelector((state) => state.opencv.opencvClickMode);

  const handleClick = () => {
    setLoading(true);
    dispatch(setOpencvClickMode("DETECT_STRAIGHT_LINE"));
    dispatch(setEnabledDrawingMode("OPENCV"));
  };

  useEffect(() => {
    if (
      enabledDrawingMode !== "OPENCV" ||
      opencvClickMode !== "DETECT_STRAIGHT_LINE"
    ) {
      setLoading(false);
    }
  }, [enabledDrawingMode, opencvClickMode]);

  return (
    <ButtonActionInPanel
      label="Détecter ligne droite"
      onClick={handleClick}
      loading={loading}
      variant="contained"
      color="action"
    />
  );
}

