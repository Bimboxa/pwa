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
  Upload,
  AutoAwesome,
  Settings,
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
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // const - tools without a `viewers` field are available in every viewer

  const toolsMap = {
    SELECTION_PROPERTIES: {
      label: "Propriétés",
      icon: <Tune />,
    },

    ANNOTATIONS_AUTO: {
      label: "Dessin auto",
      icon: <AutoFixHigh />,
      viewers: ["MAP"],
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
      viewers: ["MAP", "THREED", "MESHES"],
    },
    PRINT: {
      label: "Export",
      icon: <Print />,
      viewers: ["MAP", "THREED", "MESHES"],
    },
    ELEVATION: {
      label: "Élévation",
      icon: <Height />,
      viewers: ["MAP", "THREED", "MESHES"],
    },
    CHAT: {
      label: "Chat",
      icon: <Chat />,
    },
    IMPORT_ANNOTATIONS: {
      label: "Importer annotations",
      icon: <Upload />,
      viewers: ["MAP"],
    },
    LOCAL_LLM: {
      label: "IA locale",
      icon: <AutoAwesome />,
      disabled: !advancedLayout,
    },
  };

  // const - contextual items, not driven by appConfig.features.tools; inserted
  // right below "Propriétés" while their viewer is active.

  const contextualTools = [
    // Settings of the editor actually displayed (3D view settings — the
    // former "Vue 3D" tool — when a 3D editor is active, 2D editor settings
    // otherwise). No `viewers` constraint: available in every module.
    {
      key: "SETTINGS",
      label: "Réglages",
      icon: <Settings />,
    },
    {
      key: "BASE_MAP_TRANSFORMS",
      label: "Transfo.",
      // image with a small AI-enhancement star on its top-right corner
      icon: (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <Image />
          <AutoAwesome
            sx={{ position: "absolute", top: -5, right: -6, fontSize: 12 }}
          />
        </Box>
      ),
      viewers: ["BASE_MAPS"],
    },
  ];

  // helper

  const toolsKeys = appConfig?.features?.tools ?? [];
  let menuItems = toolsKeys.map((key) => ({ ...toolsMap[key], key, enabled: Boolean(toolsMap[key]) })).filter(t => t.enabled);

  // filter — the tools list is MODULE-driven (selectedViewerKey is the
  // module key): it never changes with the editor (2D/3D) displayed inside
  // the module.
  menuItems = menuItems.filter(t => !t.disabled);
  menuItems = menuItems.filter(
    (t) => !t.viewers || t.viewers.includes(selectedViewerKey)
  );

  // Every module shows at least the "Propriétés" tool, whichever editor is
  // displayed — guaranteed here so no appConfig or filter can drop it.
  if (!menuItems.some((t) => t.key === "SELECTION_PROPERTIES")) {
    menuItems.unshift({
      ...toolsMap.SELECTION_PROPERTIES,
      key: "SELECTION_PROPERTIES",
      enabled: true,
    });
  }

  const activeContextualTools = contextualTools.filter(
    (t) => !t.viewers || t.viewers.includes(selectedViewerKey)
  );
  if (activeContextualTools.length > 0) {
    const propertiesIndex = menuItems.findIndex(
      (t) => t.key === "SELECTION_PROPERTIES"
    );
    menuItems.splice(propertiesIndex + 1, 0, ...activeContextualTools);
  }

  // effect - close the panel when its tool leaves the menu: LOCAL_LLM when
  // advanced mode gets turned off, viewer-restricted tools when the viewer
  // changes. Keys without a `viewers` constraint (incl. panels opened
  // programmatically, e.g. NODE_FORMAT) are left untouched.

  useEffect(() => {
    const selectedTool =
      toolsMap[selectedKey] ??
      contextualTools.find((t) => t.key === selectedKey);
    const viewerMismatch =
      selectedTool?.viewers && !selectedTool.viewers.includes(selectedViewerKey);
    if ((selectedKey === "LOCAL_LLM" && !advancedLayout) || viewerMismatch) {
      dispatch(setSelectedMenuItemKey(null));
    }
  }, [selectedKey, advancedLayout, selectedViewerKey]);

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
