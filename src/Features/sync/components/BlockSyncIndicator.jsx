import useRemoteProjectContainerProps from "../hooks/useRemoteProjectContainerProps";

import {Icon, Tooltip, Box} from "@mui/material";
import {Circle, Sync, SyncDisabled} from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";
import useRemoteToken from "../hooks/useRemoteToken";
import useRemoteContainer from "../hooks/useRemoteContainer";

export default function BlockSyncIndicator({color}) {
  // data

  const remoteToken = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  // helpers

  const syncDisabled = !remoteToken || !remoteContainer;

  return (
    <BoxCenter>
      <Icon>
        {syncDisabled ? <SyncDisabled sx={{color}} /> : <Sync sx={{color}} />}
      </Icon>
    </BoxCenter>
  );
}
