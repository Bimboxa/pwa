import { useSelector, useDispatch } from "react-redux";

import { setSelectedListTypeKey } from "../listPanelSlice";

import { Box, Paper } from "@mui/material";

import listTypes from "../data/listTypes";
import VerticalMenu from "Features/layout/components/VerticalMenu";
import ListPanelV2 from "./ListPanelV2";

export default function VerticalMenuListTypes() {
  const dispatch = useDispatch();

  // helpers

  const menuItems = listTypes.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
  }));

  // data

  const selectedKey = useSelector((s) => s.listPanel.selectedListTypeKey);
  const width = useSelector((s) => s.listPanel.width);

  // helpers

  const openPanel = Boolean(selectedKey);

  // handlers

  function handleChange(newKey) {
    dispatch(setSelectedListTypeKey(newKey));
  }

  return (
    <Paper
      square
      sx={{
        display: "flex",
        flexDirection: "vertical",
        position: "relative",
        bgcolor: "white",
      }}
    >
      <VerticalMenu
        menuItems={menuItems}
        selection={selectedKey}
        onSelectionChange={handleChange}
      />

      {openPanel && (
        <Paper
          square
          sx={{
            position: "absolute",
            width,
            height: 1,
            zIndex: 100,
            right: 0,
            transform: "translateX(100%)",
          }}
        >
          <ListPanelV2 />
        </Paper>
      )}
    </Paper>
  );
}
