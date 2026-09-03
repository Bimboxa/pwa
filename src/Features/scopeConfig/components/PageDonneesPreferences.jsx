import { useSelector, useDispatch } from "react-redux";

import {
  setDisable3D,
  setConfigurationsManagement,
} from "Features/appConfig/appConfigSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import setDisable3DInLocalStorage from "Features/appConfig/services/setDisable3DInLocalStorage";
import setConfigurationsManagementInLocalStorage from "Features/appConfig/services/setConfigurationsManagementInLocalStorage";

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
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const configurationsManagement = useSelector(
    (s) => s.appConfig.configurationsManagement
  );

  // strings

  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "plan de repérage";
  const configurationsManagementS = "Gestion des configurations";
  const configurationsManagementHelperS = `Active le sélecteur de configurations à la création d'un ${scopeS.toLowerCase()}`;

  // helpers

  const version = appConfig?.version ?? "-";

  // handlers

  function handleDisable3DChange(v) {
    dispatch(setDisable3D(v));
    setDisable3DInLocalStorage(v);
  }

  function handleConfigurationsManagementChange(v) {
    dispatch(setConfigurationsManagement(v));
    setConfigurationsManagementInLocalStorage(v);
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
          value={disable3D}
          onChange={handleDisable3DChange}
          label="Désactiver la 3D"
          options={{ type: "switch" }}
        />
      </Box>

      <Box sx={{ py: 0.5 }}>
        <FieldCheck
          value={configurationsManagement}
          onChange={handleConfigurationsManagementChange}
          label={configurationsManagementS}
          options={{ type: "switch" }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", pl: 6 }}
        >
          {configurationsManagementHelperS}
        </Typography>
      </Box>

      <Box sx={{ mt: 2 }}>
        <ButtonDeleteProjects onDeleted={onClose} />
      </Box>
    </Box>
  );
}
