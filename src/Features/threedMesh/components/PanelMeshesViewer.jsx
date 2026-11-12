import { useDispatch, useSelector } from "react-redux";

import { setMesh3dGroupByOrientation } from "Features/threedEditor/threedEditorSlice";

import { Box, FormControlLabel, Switch, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";

import useMeshes3d from "../hooks/useMeshes3d";
import useMesh3dLabelPrefix from "../hooks/useMesh3dLabelPrefix";
import useMesh3dSurfaceDecimals from "../hooks/useMesh3dSurfaceDecimals";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import getMesh3dDisplayLabel from "../utils/getMesh3dDisplayLabel";
import getMesh3dOrientation from "../utils/getMesh3dOrientation";

import SectionMeshes3dList from "./SectionMeshes3dList";
import SectionMeshes3dExport from "./SectionMeshes3dExport";

// Drawer content of the MESHES viewer (left panel next to the 3D editor).
// The mailles list + export footer; the module settings live in the module
// properties panel (PanelPropertiesMeshesModule).
export default function PanelMeshesViewer() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const groupByOrientation = useSelector(
    (s) => s.threedEditor.mesh3dGroupByOrientation
  );

  const meshes3d = useMeshes3d({ projectId, scopeId });
  const { prefix } = useMesh3dLabelPrefix();
  const { surfaceDecimals } = useMesh3dSurfaceDecimals();

  const sorted = [...(meshes3d || [])].sort(
    (m1, m2) => (m1.number || 0) - (m2.number || 0)
  );
  const rows = sorted.map((mesh3d) => ({
    ...mesh3d,
    displayLabel: getMesh3dDisplayLabel(mesh3d, prefix),
    surfaceLabel: formatSurfaceM2(mesh3d.surface, surfaceDecimals),
    orientation: getMesh3dOrientation(mesh3d),
  }));

  // render

  return (
    <BoxFlexVStretch sx={{ height: 1 }}>
      {/* Header */}
      <LeftDrawerPanelHeader title="Mailles" />

      {/* Content */}
      <BoxFlexVStretch sx={{ minHeight: 0 }}>
        {rows.length > 0 && (
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <FormControlLabel
              sx={{ ml: 0 }}
              control={
                <Switch
                  size="small"
                  checked={groupByOrientation}
                  onChange={(e) =>
                    dispatch(setMesh3dGroupByOrientation(e.target.checked))
                  }
                />
              }
              label={
                <Typography variant="body2" sx={{ ml: 0.5 }}>
                  Grouper par orientation
                </Typography>
              }
            />
          </Box>
        )}
        <BoxFlexVStretch sx={{ overflow: "auto" }}>
          <SectionMeshes3dList rows={rows} />
        </BoxFlexVStretch>
        <SectionMeshes3dExport rows={rows} surfaceDecimals={surfaceDecimals} />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
