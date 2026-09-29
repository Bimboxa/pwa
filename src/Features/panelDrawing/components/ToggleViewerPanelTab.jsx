import { useDispatch, useSelector } from "react-redux";

import { setViewerPanelTab } from "../panelDrawingSlice";
import { setSoloBusinessObjectId } from "Features/businessObjects/businessObjectsSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import selectSelectedBusinessObjectId from "Features/businessObjects/utils/selectSelectedBusinessObjectId";

import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";

// Tabs toggle of the Viewer module's left panel header: "Annotations" and
// one entry per business object type of the scope (useViewerPanelTabs).
export default function ToggleViewerPanelTab({ tabs, activeKey }) {
  const dispatch = useDispatch();

  // data

  const selectedBusinessObjectId = useSelector(selectSelectedBusinessObjectId);
  const soloBusinessObjectId = useSelector(
    (s) => s.businessObjects.soloBusinessObjectId
  );

  // handlers

  // Leaving a business objects tab drops its solo display and its object
  // selection: both would keep acting on the editors with no visible row.
  function handleChange(value) {
    if (!value || value === activeKey) return;
    if (soloBusinessObjectId) dispatch(setSoloBusinessObjectId(null));
    if (selectedBusinessObjectId) dispatch(clearSelection());
    dispatch(setViewerPanelTab(value));
  }

  // render

  return (
    <Box sx={{ flex: 1, minWidth: 0, overflowX: "auto" }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={activeKey}
        onChange={(_e, v) => handleChange(v)}
      >
        {tabs.map(({ key, label }) => (
          <ToggleButton
            key={key}
            value={key}
            sx={{
              textTransform: "none",
              py: 0.25,
              px: 1.25,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
