/*
 * Vertical Menu :
 * - menuItem = {key, label, icon}
 *
 */
import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import { toggleButtonClasses } from "@mui/material/ToggleButton";
import { toggleButtonGroupClasses } from "@mui/material/ToggleButtonGroup";

import { styled } from "@mui/material/styles";

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  gap: "8px",
  [`& .${toggleButtonGroupClasses.firstButton}, & .${toggleButtonGroupClasses.middleButton}`]:
    {
      borderBottomRightRadius: (theme.vars || theme).shape.borderRadius,
      borderBottomLeftRadius: (theme.vars || theme).shape.borderRadius,
    },
  [`& .${toggleButtonGroupClasses.lastButton}, & .${toggleButtonGroupClasses.middleButton}`]:
    {
      borderTopRightRadius: (theme.vars || theme).shape.borderRadius,
      borderTopLeftRadius: (theme.vars || theme).shape.borderRadius,
      borderTop: `1px solid ${(theme.vars || theme).palette.divider}`,
    },
  [`& .${toggleButtonGroupClasses.lastButton}.${toggleButtonClasses.disabled}, & .${toggleButtonGroupClasses.middleButton}.${toggleButtonClasses.disabled}`]:
    {
      borderTop: `1px solid ${
        (theme.vars || theme).palette.action.disabledBackground
      }`,
    },
}));

export default function VerticalMenu({
  menuItems,
  selection, // item.key
  onSelectionChange,
  tooltipPlacement = "right",
}) {
  // handlers

  function handleChange(e, newKey) {
    onSelectionChange(newKey !== selection ? newKey : null);
  }

  return (
    <Box sx={{ p: 0.5, borderRadius: 1 }}>
      <StyledToggleButtonGroup
        value={selection}
        exclusive
        onChange={handleChange}
        orientation="vertical"
      >
        {menuItems.map((item) => {
          return (
            <Tooltip
              key={item.key}
              title={item.label}
              placement={tooltipPlacement}
            >
              <ToggleButton key={item.key} value={item.key}>
                {item.icon}
              </ToggleButton>
            </Tooltip>
          );
        })}
      </StyledToggleButtonGroup>
    </Box>
  );
}
