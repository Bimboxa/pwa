import { useEffect } from "react";
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
  PictureAsPdf,
  Insights as OpencvIcon,
  MoreHoriz as More,
  Image,
  Chat,
  CameraAlt,
  Tune,
  AutoFixHigh,
  Print,
  Height,
  GridOn,
  Upload,
  AutoAwesome,
  ViewInAr,
} from "@mui/icons-material";

import { Box, Paper } from "@mui/material";

import PanelShower from "Features/shower/components/PanelShower";
import PanelEditorExport from "Features/editorExport/components/PanelEditorExport";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function VerticalMenuRightPanel() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // data

  const selectedKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const isThreedViewer = useSelector(
    (s) => s.viewers.selectedViewerKey === "THREED"
  );

  // const

  const toolsMap = {
    SELECTION_PROPERTIES: {
      label: "Propriétés",
      icon: <Tune />,
    },

    ANNOTATIONS_AUTO: {
      label: "Dessin auto",
      icon: <AutoFixHigh />,
      //disabled: !advancedLayout,
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
    PRINT: {
      label: "Export",
      icon: <Print />,
    },
    ELEVATION: {
      label: "Élévation",
      icon: <Height />,
    },
    MESH: {
      label: "Maillage",
      icon: <GridOn />,
    },
    CHAT: {
      label: "Chat",
      icon: <Chat />,
    },
    IMPORT_ANNOTATIONS: {
      label: "Importer annotations",
      icon: <Upload />,
    },
    LOCAL_LLM: {
      label: "IA locale",
      icon: <AutoAwesome />,
      disabled: !advancedLayout,
    },
  };



  // helper

  const toolsKeys = appConfig?.features?.tools ?? [];
  let menuItems = toolsKeys.map((key) => ({ ...toolsMap[key], key, enabled: Boolean(toolsMap[key]) })).filter(t => t.enabled);

  // filter
  menuItems = menuItems.filter(t => !t.disabled);

  // 3D viewer properties — contextual item, only while the 3D viewer is active.
  if (isThreedViewer) {
    menuItems = [
      { key: "THREED_PROPERTIES", label: "Vue 3D", icon: <ViewInAr /> },
      ...menuItems,
    ];
  }

  // effect - close the LOCAL_LLM panel when advanced mode gets turned off

  useEffect(() => {
    if (selectedKey === "LOCAL_LLM" && !advancedLayout) {
      dispatch(setSelectedMenuItemKey(null));
    }
  }, [selectedKey, advancedLayout]);

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
