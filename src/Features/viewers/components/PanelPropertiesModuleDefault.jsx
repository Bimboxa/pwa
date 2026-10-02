import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionBaseMapOverview from "Features/baseMaps/components/SectionBaseMapOverview";
import HeaderPanelPropertiesModule from "./HeaderPanelPropertiesModule";
import SectionModuleDescription from "./SectionModuleDescription";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

// ---------------------------------------------------------------------------
// PanelPropertiesModuleDefault — default properties panel (empty selection)
// of the modules without a dedicated one (Viewer, Photos, Zones, Maillage):
// module header, what the module is for, and the main base map overview.
// ---------------------------------------------------------------------------

export default function PanelPropertiesModuleDefault({ moduleKey }) {
  // data

  const baseMap = useMainBaseMap();

  // helpers

  const titleS = baseMap?.name ?? baseMap?.label ?? "Fond de plan";

  // render

  return (
    <BoxFlexVStretch sx={{ height: "100%" }}>
      <HeaderPanelPropertiesModule moduleKey={moduleKey} title={titleS} />

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        <SectionModuleDescription moduleKey={moduleKey} />

        <SectionBaseMapOverview returnFromViewer={moduleKey} />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
