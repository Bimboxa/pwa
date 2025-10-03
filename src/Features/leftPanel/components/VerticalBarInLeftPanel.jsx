import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import { useSelector } from "react-redux";

export default function VerticalBarInLeftPanel({ children }) {
  // data

  const width = useSelector((s) => s.leftPanel.verticalBarWidth);
  //const width = 24;
  // render

  return (
    <BoxFlexVStretch
      sx={{ width: `${width}px !important`, minWidth: width, maxWidth: width }}
    >
      {children}
    </BoxFlexVStretch>
  );
}
