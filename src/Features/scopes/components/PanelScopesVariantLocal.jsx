import { useRef } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedScopeIdInDashboard } from "Features/dashboard/dashboardSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";

import useScopes from "../hooks/useScopes";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography } from "@mui/material";

import Panel from "Features/layout/components/Panel";
import PanelVariantMap from "Features/layout/components/PanelVariantMap";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ItemsList from "Features/itemsList/components/ItemsList";
import SectionCreateScopeV2 from "./SectionCreateScopeV2";

export default function PanelScopesVariantLocal() {
  const ref = useRef();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const { value: scopes } = useScopes({ withProject: true });
  const appConfig = useAppConfig();

  console.log("scopes", scopes);

  // helpers

  const title = appConfig?.strings?.scope.myScopes ?? "Mes dossiers";
  const noScopeLabel = appConfig?.strings.scope.noScope ?? "Aucun dossier";

  const items = scopes?.map((scope) => ({
    ...scope,
    primaryText: scope.name,
    secondaryText: scope.project?.name,
  }));

  // handlers

  function handleClick(scope) {
    console.log("scope", scope);
    dispatch(setSelectedScopeIdInDashboard(scope.id));
    dispatch(setSelectedScopeId(scope.id));
    dispatch(setSelectedProjectId(scope.project.id));
    navigate("/");
  }

  // render

  return (
    <PanelVariantMap>
      <Box
        ref={ref}
        sx={{
          display: "flex",
          flexDirection: "column",
          width: 1,
          minHeight: 0,
        }}
      >
        <Typography sx={{ p: 2 }} variant="h4">
          {title}
        </Typography>

        <BoxFlexVStretch>
          <ItemsList
            items={items}
            onClick={handleClick}
            maxItems={15}
            searchKeys={["name", "clientRef"]}
            noItemLabel={noScopeLabel}
            createComponent={({ onClose, onCreated }) => (
              <SectionCreateScopeV2 onClose={onClose} onCreated={onCreated} />
            )}
            containerEl={ref.current}
          />
        </BoxFlexVStretch>
      </Box>
    </PanelVariantMap>
  );
}
