/*
 * Vertical Menu :
 * - menuItem = {key, label, icon}
 *
 */
import { Box, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
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
    borderTop: `1px solid ${(theme.vars || theme).palette.action.disabledBackground
      }`,
  },
}));

const StyledToggleButton = styled(ToggleButton)(({ theme }) => ({
  backgroundColor: "white",
  "&:hover": {
    backgroundColor: theme.palette.grey[100],
  },
  "&.Mui-selected": {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
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
              <StyledToggleButton key={item.key} value={item.key}>
                {item.icon}
              </StyledToggleButton>

            </Tooltip>
          );
        })}
      </StyledToggleButtonGroup>
    </Box>
  );
}
