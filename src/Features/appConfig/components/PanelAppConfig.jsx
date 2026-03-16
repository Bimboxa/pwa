import { useSelector, useDispatch } from "react-redux";

import { setAdvancedLayout } from "../appConfigSlice";

import useAppConfig from "../hooks/useAppConfig";

import { Box, Typography } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FieldCheck from "Features/form/components/FieldCheck";

import ButtonDeleteProjects from "./ButtonDeleteProjects";

export default function PanelAppConfig({ onClose }) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);

  // helpers

  const version = appConfig?.version ?? "-";

  // handlers

  function handleAdvancedLayoutChange(v) {
    dispatch(setAdvancedLayout(v));
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Version : {version}
        </Typography>
      </Box>

      <Box sx={{ px: 1, py: 0.5 }}>
        <FieldCheck
          value={advancedLayout}
          onChange={handleAdvancedLayoutChange}
          label="Mode avancé"
          options={{ type: "switch" }}
        />
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", flexGrow: 1 }}>
        <ButtonDeleteProjects onDeleted={onClose} />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
