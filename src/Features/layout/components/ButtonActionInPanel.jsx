import { useState, useEffect } from "react";

import { Box, Typography, IconButton, Collapse, Switch } from "@mui/material";
import {
  AutoAwesome,
  Add,
  KeyboardArrowDown as Down,
  KeyboardArrowRight as Right,
} from "@mui/icons-material";

export default function ButtonActionInPanel({
  label,
  children,
  variant,
  checked,
  triggerOpenAt,
  onChange,
  ...buttonProps
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (triggerOpenAt) {
      setOpen(true);
    }
  }, [triggerOpenAt]);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: 1,
          p: 0.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            size="small"
            onClick={() => setOpen(!open)}
            sx={{ mr: 1 }}
          >
            {open ? <Down fontSize="small" /> : <Right fontSize="small" />}
          </IconButton>
          <Typography variant="body2">{label}</Typography>
        </Box>

        <Box
          sx={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {variant === "toggle" ? (
            <Switch
              size="small"
              checked={checked ?? false}
              onChange={onChange}
              color="secondary"
              {...buttonProps}
            />
          ) : (
            <IconButton {...buttonProps}>
              <AutoAwesome />
            </IconButton>
          )}
        </Box>
      </Box>
      <Collapse in={open} timeout="auto">
        <Box sx={{ p: 1, pl: "40px", pr: "16px" }}>
          <Box sx={{ bgcolor: "background.default" }}>{children}</Box>
        </Box>
      </Collapse>
    </Box>
  );
}
