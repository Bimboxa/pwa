import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import PanelViewerBusinessObjects from "Features/businessObjects/components/PanelViewerBusinessObjects";
import PanelViewerAnnotations from "./PanelViewerAnnotations";
import ToggleViewerPanelTab from "./ToggleViewerPanelTab";

import useViewerPanelTabs, {
  VIEWER_PANEL_TAB_ANNOTATIONS,
} from "../hooks/useViewerPanelTabs";

// Left panel of the Viewer module: read-only overview of the annotations or
// of the business objects of one type ("Ouvrages", "Planning"...), picked
// with the header toggle. Without any business objects in the scope, the
// header keeps its plain "Annotations" title.
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

  return <PanelViewerBusinessObjects typeKey={activeKey} header={header} />;
}
