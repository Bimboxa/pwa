import { useSelector } from "react-redux";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderPanelPropertiesModule from "Features/viewers/components/HeaderPanelPropertiesModule";
import SectionModuleDescription from "Features/viewers/components/SectionModuleDescription";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import useMeshes3d from "../hooks/useMeshes3d";
import useMesh3dLabelPrefix from "../hooks/useMesh3dLabelPrefix";
import useMesh3dSurfaceDecimals from "../hooks/useMesh3dSurfaceDecimals";
import useResetMeshes3dLabelPositions from "../hooks/useResetMeshes3dLabelPositions";

import SectionMeshes3dSettings from "./SectionMeshes3dSettings";

// ---------------------------------------------------------------------------
// PanelPropertiesMeshesModule — default properties panel of the Maillage
// module (empty selection): what the module is for and the module settings
// (display, labels, numbering prefix).
// ---------------------------------------------------------------------------

export default function PanelPropertiesMeshesModule() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const baseMap = useMainBaseMap();
  const meshes3d = useMeshes3d({ projectId, scopeId });
  const { prefix, setPrefix } = useMesh3dLabelPrefix();
  const { surfaceDecimals, setSurfaceDecimals } = useMesh3dSurfaceDecimals();
  const resetLabelPositions = useResetMeshes3dLabelPositions();

  // helpers

  const titleS = baseMap?.name ?? baseMap?.label ?? "Fond de plan";

  // render

  return (
    <BoxFlexVStretch sx={{ height: "100%" }}>
      <HeaderPanelPropertiesModule moduleKey="MESHES" title={titleS} />

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        <SectionModuleDescription moduleKey="MESHES" />

        <SectionMeshes3dSettings
          prefix={prefix}
          onPrefixChange={setPrefix}
          surfaceDecimals={surfaceDecimals}
          onSurfaceDecimalsChange={setSurfaceDecimals}
          meshes3d={meshes3d}
          onResetLabelPositions={() => resetLabelPositions(meshes3d || [])}
        />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
