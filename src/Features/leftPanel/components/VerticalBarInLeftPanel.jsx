import BoxFlexHStretch from "Features/layout/components/BoxFlexHStretch";
import { useSelector } from "react-redux";

export default function VerticalBarInLeftPanel({ children }) {
  // data

  const width = useSelector((s) => s.leftPanel.verticalBarWidth);

  // render

  return <BoxFlexHStretch sx={{ width }}>{children}</BoxFlexHStretch>;
}
