import { useSelector, useDispatch } from "react-redux";

import {
  setAdvancedLayout,
  setDisable3D,
} from "Features/appConfig/appConfigSlice";
import { setChronoVisible } from "Features/chrono/chronoSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import setDisable3DInLocalStorage from "Features/appConfig/services/setDisable3DInLocalStorage";

import { Box, Typography } from "@mui/material";
import FieldCheck from "Features/form/components/FieldCheck";

import ButtonDeleteProjects from "Features/appConfig/components/ButtonDeleteProjects";

// "Généralités > Données & préférences" page: device-level settings and local
// data management (the former compact PanelAppConfig, minus the satellite
// block which moved to the "Carte satellite" editor page).
export default function PageDonneesPreferences({ onClose }) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const chronoVisible = useSelector((s) => s.chrono.visible);

  // helpers

  const version = appConfig?.version ?? "-";

  // handlers

  function handleAdvancedLayoutChange(v) {
    dispatch(setAdvancedLayout(v));
  }

  function handleDisable3DChange(v) {
    dispatch(setDisable3D(v));
    setDisable3DInLocalStorage(v);
  }

  function handleChronoVisibleChange(v) {
    dispatch(setChronoVisible(v));
  }

  // render

  return (
    <Box sx={{ px: 3, py: 2, maxWidth: 560 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Données & préférences
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Version : {version}
      </Typography>

      <Box sx={{ py: 0.5 }}>
        <FieldCheck
          value={advancedLayout}
          onChange={handleAdvancedLayoutChange}
          label="Mode avancé"
          options={{ type: "switch" }}
        />
      </Box>

      <Box sx={{ py: 0.5 }}>
        <FieldCheck
          value={disable3D}
          onChange={handleDisable3DChange}
          label="Désactiver la 3D"
          options={{ type: "switch" }}
        />
      </Box>

      <Box sx={{ py: 0.5 }}>
        <FieldCheck
          value={chronoVisible}
          onChange={handleChronoVisibleChange}
          label="Afficher le chrono"
          options={{ type: "switch" }}
        />
      </Box>

      <Box sx={{ mt: 2 }}>
        <ButtonDeleteProjects onDeleted={onClose} />
      </Box>
    </Box>
  );
}
