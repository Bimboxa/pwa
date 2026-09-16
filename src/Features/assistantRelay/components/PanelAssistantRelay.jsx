import { useDispatch } from "react-redux";

import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Divider, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";

import useAssistantRelayConfig from "../hooks/useAssistantRelayConfig";
import useAssistantRelaySession from "../hooks/useAssistantRelaySession";
import useDetectionJobsRealtime from "../hooks/useDetectionJobsRealtime";

import SectionAssistantRelayConnection from "./SectionAssistantRelayConnection";
import SectionAssistantRelayBaseMap from "./SectionAssistantRelayBaseMap";
import ListBaseMapJobs from "./ListBaseMapJobs";
import ListDetectionJobs from "./ListDetectionJobs";

// The "Assistant IA" right-panel tool: pairing with the reperage-mcp relay,
// publication of the current base map for ChatGPT, import of the base maps
// proposed from the ChatGPT component (PDF page rasterized here) and import
// of the annotation proposals it sends back (docs: reperage-mcp/README.md).
export default function PanelAssistantRelay() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Assistant IA (ChatGPT)";
  const notConfiguredS =
    "Fonction non configurée pour cette organisation (appConfig.features.assistantRelay).";

  // data

  const config = useAssistantRelayConfig();
  const { connected, connectionStatus, connectionError, refresh } =
    useAssistantRelaySession();
  const { realtimeStatus } = useDetectionJobsRealtime({ connected, refresh });

  // handlers

  function handleClose() {
    dispatch(setSelectedMenuItemKey(null));
  }

  // render

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={titleS} onClose={handleClose} />

      {!config?.enabled || !config?.relayBaseUrl ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
          {notConfiguredS}
        </Typography>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <SectionAssistantRelayConnection
            connectionStatus={connectionStatus}
            connectionError={connectionError}
            relayBaseUrl={config.relayBaseUrl}
            onRefresh={refresh}
          />

          {connected && (
            <>
              <Divider />
              <SectionAssistantRelayBaseMap />
              <Divider />
              <ListBaseMapJobs />
              <Divider />
              <ListDetectionJobs realtimeStatus={realtimeStatus} />
            </>
          )}
        </Box>
      )}
    </BoxFlexVStretch>
  );
}
