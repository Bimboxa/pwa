import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  toggleItemSelection,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import {
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
  Box,
} from "@mui/material";
import { CenterFocusStrong } from "@mui/icons-material";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import getMesh3dBox3 from "../utils/getMesh3dBox3";
import getMesh3dLabelAnchor from "../utils/getMesh3dLabelAnchor";

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

  // Last maille focused and the face side used, so pressing Focus again on
  // the same maille flips the camera to the other face.
  const focusSideRef = useRef({ id: null, side: null });

  // Place the camera face-on to the maille without touching the selection.
  async function handleFocusClick(e, mesh3d) {
    e.stopPropagation();
    const editor = getActiveThreedEditor();
    const box = getMesh3dBox3(mesh3d);
    if (!editor || !box) return;

    const prev = focusSideRef.current;
    const requestedSide =
      prev.id === mesh3d.id && prev.side ? -prev.side : null;
    const side = await editor.fitToBox3Facing(
      box,
      getMesh3dLabelAnchor(mesh3d)?.n,
      requestedSide
    );
    focusSideRef.current = { id: mesh3d.id, side };
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
            sx={{ py: 0.5, "&:hover .mesh3d-focus-btn": { opacity: 1 } }}
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
            {/* Same qty style as the PopperMapListings annotation rows */}
            <Typography
              align="right"
              noWrap
              sx={{
                fontSize: "10px",
                minWidth: "40px",
                fontFamily: "monospace",
                fontWeight: 500,
              }}
              color={mesh3d.surface > 0 ? "secondary.main" : "panel.countEmpty"}
            >
              {mesh3d.surfaceLabel}
            </Typography>
            {/* Always in the layout (opacity-only reveal → no content jump) */}
            <Tooltip title="Zoomer sur la maille" placement="right">
              <IconButton
                className="mesh3d-focus-btn"
                size="small"
                onClick={(e) => handleFocusClick(e, mesh3d)}
                sx={{ ml: 0.5, opacity: 0, transition: "opacity 0.15s" }}
              >
                <CenterFocusStrong fontSize="small" />
              </IconButton>
            </Tooltip>
          </ListItemButton>
        );
      })}
    </List>
  );
}
