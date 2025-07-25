import { useSelector } from "react-redux";

import PanelScopesVariantLocal from "Features/scopes/components/PanelScopesVariantLocal";
import PanelMasterProjects from "Features/masterProjects/components/PanelMasterProjects";

export default function PanelMainSelector() {
  // data

  const selectedKey = useSelector((s) => s.dashboard.selectedMenuItemKey);

  // render

  switch (selectedKey) {
    case "MY_SCOPES":
      return <PanelScopesVariantLocal />;
    case "PROJECTS":
      return <PanelMasterProjects />;
  }
}
