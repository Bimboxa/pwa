import { useDispatch, useSelector } from "react-redux";

import { setPrintModeEnabled } from "../mapEditorSlice";

import { Box } from "@mui/material";

import SwitchGeneric from "Features/layout/components/SwitchGeneric";

export default function BlockPrintMode() {
  const dispatch = useDispatch();

  // strings

  const printModeLabel = "Mode impression";

  // data

  const printModeEnabled = useSelector((s) => s.mapEditor.printModeEnabled);

  // handlers

  function handleClick() {
    dispatch(setPrintModeEnabled(!printModeEnabled));
  }

  // render

  return (
    <Box>
      <SwitchGeneric
        label={printModeLabel}
        checked={printModeEnabled}
        onChange={handleClick}
      />
    </Box>
  );
}
