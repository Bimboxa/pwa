import { useSelector } from "react-redux";

import PanelCreateDataVariantHorizontal from "./PanelCreateDataVariantHorizontal";
import PanelCreateDataOverview from "./PanelCreateDataOverview";

export default function PanelCreateData({ isMobile }) {
  // data

  const showOverview = useSelector((s) => s.onboarding.showOverview);

  // render

  if (showOverview) return <PanelCreateDataOverview />;

  return <PanelCreateDataVariantHorizontal />;
}
