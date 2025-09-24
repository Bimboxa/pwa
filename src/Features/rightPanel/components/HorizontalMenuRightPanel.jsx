import { useDispatch, useSelector } from "react-redux";

import { setSelectedMenuItemKey } from "../rightPanelSlice";

import VerticalMenu from "Features/layout/components/VerticalMenu";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

import {
  Download,
  Info,
  Visibility,
  Palette,
  Layers,
  Edit,
} from "@mui/icons-material";

import { Box, Paper } from "@mui/material";

import PanelShower from "Features/shower/components/PanelShower";
import PanelEditorExport from "Features/editorExport/components/PanelEditorExport";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

export default function HorizontalMenuRightPanel() {
  const dispatch = useDispatch();

  // const

  const menuItems = [
    // {
    //   key: "SHOWER",
    //   label: "Calques",
    //   icon: <Layers />,
    // },
    {
      key: "ANNOTATION_FORMAT",
      label: "Format",
      icon: <Palette />,
    },
    // {
    //   key: "ENTITY",
    //   label: "Edition",
    //   icon: <Edit />,
    // },
    // {
    //   key: "EDITOR_EXPORT",
    //   label: "Export",
    //   icon: <Download />,
    // },
  ];

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

  if (!scopeId || !baseMapId) return null;

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
