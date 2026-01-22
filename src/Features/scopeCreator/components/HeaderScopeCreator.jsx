import { useDispatch } from "react-redux";

import {
  setOpenScopeCreator,
  setStepKey,
  setSelectedProjectId,
  setSelectedPresetScopeKey,
} from "../scopeCreatorSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography } from "@mui/material";
import IconButtonClose from "Features/layout/components/IconButtonClose";

export default function HeaderScopeCreator() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // helper

  const title = appConfig?.strings?.scope?.new ?? "Créer un scope";

  // handlers

  function handleClose() {
    dispatch(setStepKey("SEARCH_PROJECT"));
    dispatch(setSelectedProjectId(null));
    dispatch(setSelectedPresetScopeKey(null));
    dispatch(setOpenScopeCreator(false));
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        p: 1,
        bgcolor: "background.default",
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography>{title}</Typography>
      <IconButtonClose onClose={handleClose} />
    </Box>
  );
}
