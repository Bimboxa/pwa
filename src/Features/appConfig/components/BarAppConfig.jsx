import { useDispatch } from "react-redux";

import { setOpenAppConfig } from "../appConfigSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography, IconButton } from "@mui/material";
import { Settings } from "@mui/icons-material";

// Org-name bar of the project/scope selector pages. The gear opens the
// full-page Configuration dialog (DialogConfiguration, mounted globally in
// MainApp) — without a selected scope it shows only the Généralités and
// Éditeurs sections.
export default function BarAppConfig() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // helpers

  const name = appConfig?.name ?? "...";

  // handlers

  function handleClick() {
    dispatch(setOpenAppConfig(true));
  }

  // render

  return (
    <Box
      sx={{
        width: 1,
        display: "flex",
        justifyContent: "space-between",
        p: 1,
        alignItems: "center",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {name}
      </Typography>
      <IconButton onClick={handleClick} size="small">
        <Settings fontSize="small" />
      </IconButton>
    </Box>
  );
}
