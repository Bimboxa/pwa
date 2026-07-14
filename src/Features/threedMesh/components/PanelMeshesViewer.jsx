import { useState } from "react";

import { useSelector } from "react-redux";

import { Box, Chip, Tab, Tabs, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import useMeshes3d from "../hooks/useMeshes3d";
import useMesh3dLabelPrefix from "../hooks/useMesh3dLabelPrefix";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import getMesh3dDisplayLabel from "../utils/getMesh3dDisplayLabel";

import SectionMeshes3dList from "./SectionMeshes3dList";
import SectionMeshes3dExport from "./SectionMeshes3dExport";
import SectionMeshes3dSettings from "./SectionMeshes3dSettings";

// Drawer content of the MESHES viewer (left panel next to the 3D editor).
// Two tabs: "Liste" (mailles list + export footer) and "Réglages" (display
// settings moved from the old rightPanel Maillage tool).
export default function PanelMeshesViewer() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const meshes3d = useMeshes3d({ projectId, scopeId });
  const { prefix, setPrefix } = useMesh3dLabelPrefix();

  const sorted = [...(meshes3d || [])].sort(
    (m1, m2) => (m1.number || 0) - (m2.number || 0)
  );
  const rows = sorted.map((mesh3d) => ({
    ...mesh3d,
    displayLabel: getMesh3dDisplayLabel(mesh3d, prefix),
    surfaceLabel: formatSurfaceM2(mesh3d.surface),
  }));

  // state

  const [tab, setTab] = useState("LIST");

  // render

  return (
    <BoxFlexVStretch sx={{ height: 1 }}>
      {/* Header */}
      <Box
        sx={{
          p: 0.5,
          pl: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{
              fontStyle: "italic",
              fontSize: (theme) => theme.typography.caption.fontSize,
            }}
          >
            Module
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            Maillage
          </Typography>
        </Box>
        <Chip label={rows.length} size="small" sx={{ mr: 1 }} />
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tab label="Liste" value="LIST" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab
          label="Réglages"
          value="SETTINGS"
          sx={{ minHeight: 36, py: 0.5 }}
        />
      </Tabs>

      {/* Content */}
      {tab === "LIST" && (
        <BoxFlexVStretch sx={{ minHeight: 0 }}>
          <BoxFlexVStretch sx={{ overflow: "auto" }}>
            <SectionMeshes3dList rows={rows} />
          </BoxFlexVStretch>
          <SectionMeshes3dExport rows={rows} />
        </BoxFlexVStretch>
      )}
      {tab === "SETTINGS" && (
        <BoxFlexVStretch sx={{ overflow: "auto" }}>
          <SectionMeshes3dSettings prefix={prefix} onPrefixChange={setPrefix} />
        </BoxFlexVStretch>
      )}
    </BoxFlexVStretch>
  );
}
