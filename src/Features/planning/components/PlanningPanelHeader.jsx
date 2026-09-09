import { useState } from "react";
import { useDispatch } from "react-redux";

import { setPanelOpen } from "../planningSlice";

import { Box, IconButton, Typography } from "@mui/material";
import { Close, Settings } from "@mui/icons-material";

import PopoverPlanningSettings from "./PopoverPlanningSettings";
import SectionPlanningPlayControls from "./SectionPlanningPlayControls";
import { formatHours } from "Features/businessObjects/utils/hoursRatioConversions";

export default function PlanningPanelHeader({
  planning,
  totalConsumed,
  totalBudget,
}) {
  const dispatch = useDispatch();
  const [settingsAnchor, setSettingsAnchor] = useState(null);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.25,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "panel.sectionBg",
      }}
    >
      <Typography variant="subtitle2" noWrap sx={{ flex: 1, minWidth: 0 }}>
        {planning?.label ?? "Planning"}
      </Typography>
      <SectionPlanningPlayControls planning={planning} />
      <Typography variant="caption" color="text.secondary" noWrap>
        {`${formatHours(totalConsumed ?? 0, { withDays: false })} planifiées / ${formatHours(
          totalBudget ?? 0
        )} budget`}
      </Typography>
      <IconButton
        size="small"
        onClick={(e) => setSettingsAnchor(e.currentTarget)}
        disabled={!planning}
        title="Réglages du planning"
      >
        <Settings sx={{ fontSize: 18 }} />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => dispatch(setPanelOpen(false))}
        title="Fermer"
      >
        <Close sx={{ fontSize: 18 }} />
      </IconButton>
      {settingsAnchor && (
        <PopoverPlanningSettings
          anchorEl={settingsAnchor}
          planning={planning}
          onClose={() => setSettingsAnchor(null)}
        />
      )}
    </Box>
  );
}
