import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  toggleItemSelection,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import {
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
} from "@mui/material";

// List of the mailles in the MESHES viewer drawer: label left, surface right.
// Clicking a row writes the same MESH3D selection item as a click on the
// maille in the 3D scene (MainThreedEditor.handleClick), so highlight and
// poppers stay in sync in both directions.
export default function SectionMeshes3dList({ rows }) {
  const dispatch = useDispatch();

  // data

  const selectedIdsKey = useSelector((s) => {
    const items = selectSelectedItems(s);
    return items
      .filter((it) => it?.type === "NODE" && it?.nodeType === "MESH3D")
      .map((it) => it.nodeId)
      .sort()
      .join(",");
  });
  const selectedIds = new Set(selectedIdsKey ? selectedIdsKey.split(",") : []);

  // refs - scroll the first selected row into view on selection from 3D

  const itemRefs = useRef({});

  useEffect(() => {
    const firstId = selectedIdsKey.split(",")[0];
    if (!firstId) return;
    itemRefs.current[firstId]?.scrollIntoView({ block: "nearest" });
  }, [selectedIdsKey]);

  // handlers

  function handleClick(e, mesh3d) {
    const item = {
      id: mesh3d.id,
      nodeId: mesh3d.id,
      type: "NODE",
      nodeType: "MESH3D",
    };
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      dispatch(toggleItemSelection(item));
    } else {
      dispatch(setSelectedItem(item));
    }
  }

  // render

  if (!rows.length) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aucune maille dans cette étendue.
        </Typography>
      </Box>
    );
  }

  return (
    <List dense disablePadding>
      {rows.map((mesh3d) => {
        const selected = selectedIds.has(mesh3d.id);
        return (
          <ListItemButton
            key={mesh3d.id}
            ref={(el) => {
              itemRefs.current[mesh3d.id] = el;
            }}
            selected={selected}
            onClick={(e) => handleClick(e, mesh3d)}
            sx={{ py: 0.5 }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                minWidth: 12,
                borderRadius: "3px",
                bgcolor: mesh3d.color,
                border: "1px solid",
                borderColor: "divider",
                mr: 1,
              }}
            />
            <ListItemText
              primary={
                <Typography
                  variant="body2"
                  sx={{ fontWeight: selected ? "bold" : "normal" }}
                >
                  {mesh3d.displayLabel}
                </Typography>
              }
            />
            <Typography variant="body2" color="text.secondary">
              {mesh3d.surfaceLabel}
            </Typography>
          </ListItemButton>
        );
      })}
    </List>
  );
}
