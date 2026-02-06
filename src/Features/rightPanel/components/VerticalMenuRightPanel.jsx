import { useDispatch, useSelector } from "react-redux";

import { setSelectedMenuItemKey } from "../rightPanelSlice";

import VerticalMenuV2 from "Features/layout/components/VerticalMenuV2";

import {
  Download,
  Info,
  Visibility,
  Palette,
  Layers,
  Edit,
  Wallpaper,
  Room,
  PictureAsPdf as Export,
  Insights as OpencvIcon,
  MoreHoriz as More,
  Image,
  Map,
  Chat,
  CameraAlt,
  Tune,
} from "@mui/icons-material";

import { Box, Paper } from "@mui/material";

import PanelShower from "Features/shower/components/PanelShower";
import PanelEditorExport from "Features/editorExport/components/PanelEditorExport";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function VerticalMenuRightPanel() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // const

  const toolsMap = {
    BASE_MAP: {
      label: "Fond de plan",
      icon: <Map />
    },

    EXPORT: {
      label: "Export",
      icon: <Export />,
    },
    SELECTION_PROPERTIES: {
      label: "Propriétés",
      icon: <Tune />,
    },

    ENTITY: {
      label: "Édition",
      icon: <Edit />,
    },
    ENTITY_ZONES: {
      label: "Localisation",
      icon: <Room />,
    },

    MASTER_PROJECT_PICTURES: {
      label: appConfig?.features?.masterProjectPictures?.title,
      icon: <CameraAlt />,
    },
    CHAT: {
      label: "Chat",
      icon: <Chat />,
    },
  };

  // data

  const selectedKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);

  // helper

  const toolsKeys = appConfig?.features?.tools ?? [];
  let menuItems = toolsKeys.map((key) => ({ ...toolsMap[key], key, enabled: Boolean(toolsMap[key]) })).filter(t => t.enabled);


  // handlers

  function handleChange(newKey) {
    dispatch(setSelectedMenuItemKey(newKey));
  }

  return (
    <Box
      sx={{
        //borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        //justifyContent: "center",
        bgcolor: "background.default",
        height: 1,
        borderLeft: theme => `1px solid ${theme.palette.divider}`
      }}
    >
      <VerticalMenuV2
        menuItems={menuItems}
        selection={selectedKey}
        onSelectionChange={handleChange}
      />
    </Box>
  );
}
