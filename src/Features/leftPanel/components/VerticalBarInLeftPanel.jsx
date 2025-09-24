import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import { useSelector } from "react-redux";

export default function VerticalBarInLeftPanel({ children }) {
  // data

  const width = useSelector((s) => s.leftPanel.verticalBarWidth);

  // render

  return (
    <BoxFlexVStretch sx={{ width, minWidth: width }}>
      {children}
    </BoxFlexVStretch>
  );
}
