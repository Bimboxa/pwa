import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedMenuItemKey } from "../rightPanelSlice";

import { Box } from "@mui/material";

import VerticalMenuV2 from "Features/layout/components/VerticalMenuV2";

import useRightPanelTools from "../hooks/useRightPanelTools";

export default function VerticalMenuRightPanel() {
  const dispatch = useDispatch();

  // data

  const selectedKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // The tool list (filtered by module + appConfig.features.tools) is built in a
  // shared hook so the keyboard shortcuts (useRightPanelToolHotkeys) bind exactly
  // the tools shown here.
  const { menuItems, toolsByKey } = useRightPanelTools();

  // effect - close the panel when its tool leaves the menu: LOCAL_LLM when
  // advanced mode gets turned off, viewer-restricted tools when the viewer
  // changes. Keys without a `viewers` constraint (incl. panels opened
  // programmatically, e.g. NODE_FORMAT) are left untouched.

  useEffect(() => {
    const selectedTool = toolsByKey[selectedKey];
    const viewerMismatch =
      selectedTool?.viewers &&
      !selectedTool.viewers.includes(selectedViewerKey);
    if ((selectedKey === "LOCAL_LLM" && !advancedLayout) || viewerMismatch) {
      dispatch(setSelectedMenuItemKey(null));
    }
  }, [selectedKey, advancedLayout, selectedViewerKey]);

  // handlers

  function handleChange(newKey) {
    dispatch(setSelectedMenuItemKey(newKey));
  }

  return (
    <Box
      sx={{
        //borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        //justifyContent: "center",
        bgcolor: "background.default",
        height: 1,
        borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <VerticalMenuV2
        menuItems={menuItems}
        selection={selectedKey}
        onSelectionChange={handleChange}
      />
    </Box>
  );
}
