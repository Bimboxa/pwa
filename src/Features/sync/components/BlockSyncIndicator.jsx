import useRemoteProjectContainerProps from "../hooks/useRemoteProjectContainerProps";

import {Icon, Tooltip, Box} from "@mui/material";
import {Circle} from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";

export default function BlockSyncIndicator({color}) {
  // data

  const {value: props} = useRemoteProjectContainerProps();

  // helpers

  return (
    <BoxCenter>
      <Icon>
        <Circle sx={{color}} />
      </Icon>
    </BoxCenter>
  );
}
