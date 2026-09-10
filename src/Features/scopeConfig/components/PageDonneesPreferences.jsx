import { useSelector, useDispatch } from "react-redux";

import { setConfigurationsManagement } from "Features/appConfig/appConfigSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import setConfigurationsManagementInLocalStorage from "Features/appConfig/services/setConfigurationsManagementInLocalStorage";

import { Box, List, Typography } from "@mui/material";
import Tune from "@mui/icons-material/Tune";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import ButtonDeleteProjects from "Features/appConfig/components/ButtonDeleteProjects";

import PageConfigLayout from "./PageConfigLayout";
import RowConfig from "./RowItemConfig";

// "Généralités > Données & préférences" page: the device-level settings in
// one white section, the local data management in another. The 3D switch
// moved to "Modules & outils" (SectionThreedConfig), where it sits next to
// the modules it gates.
export default function PageDonneesPreferences({ onClose }) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const configurationsManagement = useSelector(
    (s) => s.appConfig.configurationsManagement
  );

  // strings

  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "plan de repérage";
  const titleS = "Données & préférences";
  const configurationS = "Configuration";
  const configurationsManagementS = "Gestion des configurations";
  const configurationsManagementHelperS = `Active le sélecteur de configurations à la création d'un ${scopeS.toLowerCase()}`;
  const dataS = "Données";
  const dataHelperS = "Projets et plans stockés sur cet appareil.";

  // helpers

  const version = appConfig?.version ?? "-";

  // handlers

  function handleConfigurationsManagementToggle() {
    const next = !configurationsManagement;
    dispatch(setConfigurationsManagement(next));
    setConfigurationsManagementInLocalStorage(next);
  }

  // render

  return (
    <PageConfigLayout title={titleS} subtitle={`Version : ${version}`}>
      <WhiteSectionGeneric>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <WhiteSectionTitle>{configurationS}</WhiteSectionTitle>

          {/* same row as the Modules & outils lists: one click anywhere
              toggles, no handle — there is nothing to reorder here */}
          <List disablePadding>
            <RowConfig
              item={{
                key: "CONFIGURATIONS_MANAGEMENT",
                icon: <Tune />,
                label: configurationsManagementS,
                caption: configurationsManagementHelperS,
                checked: Boolean(configurationsManagement),
              }}
              onToggle={handleConfigurationsManagementToggle}
            />
          </List>
        </Box>
      </WhiteSectionGeneric>

      <WhiteSectionGeneric>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box>
            <WhiteSectionTitle>{dataS}</WhiteSectionTitle>
            <Typography variant="caption" color="text.secondary">
              {dataHelperS}
            </Typography>
          </Box>

          <Box sx={{ py: 1 }}>
            <ButtonDeleteProjects onDeleted={onClose} />
          </Box>
        </Box>
      </WhiteSectionGeneric>
    </PageConfigLayout>
  );
}
