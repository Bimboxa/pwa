import { useMemo } from "react";

import { useSelector } from "react-redux";

import useMeshes3d from "./useMeshes3d";
import useMesh3dLabelPrefix from "./useMesh3dLabelPrefix";
import useMesh3dSurfaceDecimals from "./useMesh3dSurfaceDecimals";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import getMesh3dDisplayLabel from "../utils/getMesh3dDisplayLabel";
import getMesh3dOrientation from "../utils/getMesh3dOrientation";

// Mailles of the selected scope, sorted by number and decorated for display
// (`displayLabel`, `surfaceLabel`, `orientation`) — the rows shared by the
// mailles drawer, the "Maillage" side of the annotations popper and the
// mailles export of the Export tool.
export default function useMeshes3dRows() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const meshes3d = useMeshes3d({ projectId, scopeId });
  const { prefix } = useMesh3dLabelPrefix();
  const { surfaceDecimals } = useMesh3dSurfaceDecimals();

  // helpers

  const rows = useMemo(() => {
    const sorted = [...(meshes3d || [])].sort(
      (m1, m2) => (m1.number || 0) - (m2.number || 0)
    );
    return sorted.map((mesh3d) => ({
      ...mesh3d,
      displayLabel: getMesh3dDisplayLabel(mesh3d, prefix),
      surfaceLabel: formatSurfaceM2(mesh3d.surface, surfaceDecimals),
      orientation: getMesh3dOrientation(mesh3d),
    }));
  }, [meshes3d, prefix, surfaceDecimals]);

  return { rows, surfaceDecimals };
}
