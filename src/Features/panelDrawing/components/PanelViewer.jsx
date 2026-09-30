import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import PanelViewerBusinessObjects from "Features/businessObjects/components/PanelViewerBusinessObjects";
import PanelViewerAnnotations from "./PanelViewerAnnotations";
import PanelViewerBaseMaps from "./PanelViewerBaseMaps";
import ToggleViewerPanelTab from "./ToggleViewerPanelTab";

import useViewerPanelTabs, {
  VIEWER_PANEL_TAB_ANNOTATIONS,
  VIEWER_PANEL_TAB_BASE_MAPS,
} from "../hooks/useViewerPanelTabs";

// Left panel of the Viewer module: read-only overview of the annotations,
// the base maps (visibility toggles) or the business objects of one type
// ("Ouvrages", "Planning"...), picked with the header toggle.
export default function PanelViewer() {
  // data

  const { tabs, activeKey } = useViewerPanelTabs();

  // render

  const header =
    tabs.length > 1 ? (
      <LeftDrawerPanelHeader>
        <ToggleViewerPanelTab tabs={tabs} activeKey={activeKey} />
      </LeftDrawerPanelHeader>
    ) : (
      <LeftDrawerPanelHeader title={tabs[0].label} />
    );

  if (activeKey === VIEWER_PANEL_TAB_ANNOTATIONS)
    return <PanelViewerAnnotations header={header} />;

  if (activeKey === VIEWER_PANEL_TAB_BASE_MAPS)
    return <PanelViewerBaseMaps header={header} />;

  return <PanelViewerBusinessObjects typeKey={activeKey} header={header} />;
}
