import { useDispatch, useSelector } from "react-redux";

import { setSelectedMenuItemKey } from "../rightPanelSlice";

import VerticalMenu from "Features/layout/components/VerticalMenu";

import { Download, Info, Visibility } from "@mui/icons-material";

import { Box, Paper } from "@mui/material";

import PanelShower from "Features/shower/components/PanelShower";
import PanelEditorExport from "Features/editorExport/components/PanelEditorExport";

export default function VerticalMenuRightPanel() {
  const dispatch = useDispatch();

  // const

  const menuItems = [
    {
      key: "SHOWER",
      label: "Affichage",
      icon: <Visibility />,
    },
    {
      key: "ENTITY_SELECTION",
      label: "Sélection",
      icon: <Info />,
    },
    {
      key: "EDITOR_EXPORT",
      label: "Export",
      icon: <Download />,
    },
  ];

  // data

  const selectedKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const width = useSelector((s) => s.rightPanel.width);

  // helper

  const openPanel = Boolean(selectedKey);

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
      }}
    >
      <VerticalMenu
        menuItems={menuItems}
        selection={selectedKey}
        onSelectionChange={handleChange}
      />
      {openPanel && (
        <Paper
          sx={{
            position: "absolute",
            top: 5,
            left: -5,
            transform: "translateX(-100%)",
            width,
            minHeight: 100,
            bgcolor: "white",
            zIndex: 200,
          }}
        >
          {selectedKey === "SHOWER" && <PanelShower />}
          {selectedKey === "EDITOR_EXPORT" && <PanelEditorExport />}
        </Paper>
      )}
    </Box>
  );
}
