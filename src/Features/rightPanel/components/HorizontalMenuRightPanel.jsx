import { useDispatch, useSelector } from "react-redux";

import { setSelectedMenuItemKey } from "../rightPanelSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import VerticalMenu from "Features/layout/components/VerticalMenu";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

import {
  Download,
  Info,
  Visibility,
  Palette,
  Layers,
  Edit,
  Wallpaper,
  Room,
  PictureAsPdf,
  Insights as OpencvIcon,
  MoreHoriz as More,
} from "@mui/icons-material";

import { Box, Paper } from "@mui/material";

import PanelShower from "Features/shower/components/PanelShower";
import PanelEditorExport from "Features/editorExport/components/PanelEditorExport";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

export default function HorizontalMenuRightPanel() {
  const dispatch = useDispatch();

  const appConfig = useAppConfig();

  // helpers

  const toolsMap = {
    PDF_REPORT: {
      label: "Export PDF",
      icon: <PictureAsPdf />,
    },
    ENTITY_ZONES: {
      label: "Localisation",
      icon: <Room />,
    },
    OPENCV: {
      label: "Traitement d'image",
      icon: <OpencvIcon />,
    },
    TOOLS: {
      label: "Autres outils",
      icon: <More />,
    },
  };

  const toolsKeys = appConfig?.features?.tools ?? [];
  const menuItems = toolsKeys.map((key) => ({ ...toolsMap[key], key }));

  // data

  const selectedKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const projectBaseMaps = useProjectBaseMapListings();
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // helper

  const openPanel = Boolean(selectedKey);
  const hasBaseMaps = projectBaseMaps?.length > 0;

  // handlers

  function handleChange(newKey) {
    dispatch(setSelectedMenuItemKey(newKey));
  }

  // render

  if (!baseMapId) return null;

  return (
    <Box
      sx={{
        //borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        //justifyContent: "center",
      }}
    >
      <ToggleSingleSelectorGeneric
        options={menuItems}
        selectedKey={selectedKey}
        onChange={handleChange}
        disabled={!hasBaseMaps}
      />
    </Box>
  );
}
