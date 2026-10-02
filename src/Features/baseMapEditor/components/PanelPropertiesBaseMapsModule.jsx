import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderPanelPropertiesModule from "Features/viewers/components/HeaderPanelPropertiesModule";
import SectionModuleDescription from "Features/viewers/components/SectionModuleDescription";
import SectionBaseMapsImageMode from "Features/baseMaps/components/SectionBaseMapsImageMode";
import SectionBaseMapOverview from "Features/baseMaps/components/SectionBaseMapOverview";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

// ---------------------------------------------------------------------------
// PanelPropertiesBaseMapsModule — default properties panel of the Fonds de
// plan module (empty selection): what the module is for, the global display
// of the base map images, and the main base map overview (its "Voir le
// détail" opens the base map properties in place).
// ---------------------------------------------------------------------------

export default function PanelPropertiesBaseMapsModule() {
  // data

  const { value: selectedScope } = useSelectedScope();

  // helpers

  const titleS = selectedScope?.name ?? "-";

  // render

  return (
    <BoxFlexVStretch sx={{ height: "100%" }}>
      <HeaderPanelPropertiesModule moduleKey="BASE_MAPS" title={titleS} />

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        <SectionModuleDescription moduleKey="BASE_MAPS" />

        <SectionBaseMapsImageMode />

        <SectionBaseMapOverview returnFromViewer="BASE_MAPS" />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
