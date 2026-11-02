import {
  Box,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  SquareOutlined as SquareIcon,
  CircleOutlined as CircleIcon,
} from "@mui/icons-material";

import FieldAnnotationHeight from "./FieldAnnotationHeight";

import useSelectedPointsData from "Features/points/hooks/useSelectedPointsData";
import useUpdateSelectedPoints from "Features/points/hooks/useUpdateSelectedPoints";
import useSetBasePoint from "Features/points/hooks/useSetBasePoint";

// Inline editor row for the sub-selected vertex (or vertices) of an
// annotation: shape toggle (square / circle), 3D offsets (bottom / top, m)
// and, on profile annotations with a single vertex, the reference point
// switch (anchor of the profile extrusion). Same persistence as the
// PanelPropertiesPoints right panel — this row surfaces those props in the
// floating toolbar so the user does not have to open the panel.
export default function ToolbarEditPoint() {
  // data

  const { annotation, selectedPoints, mixed } = useSelectedPointsData();
  const updateSelectedPoints = useUpdateSelectedPoints();
  const setBasePoint = useSetBasePoint();

  // helpers

  const count = selectedPoints.length;
  const first = selectedPoints[0];

  const typeValue = mixed.type ? null : (first?.type ?? "square");

  // FieldAnnotationHeight reads `[field]` on the object it is given: feed it
  // a point-shaped record (keyed on the point id so the local draft resets
  // when the selection changes). Mixed values show as an empty field.
  const offsetsRecord = {
    id: selectedPoints.map((p) => p.id).join("|"),
    offsetBottom: mixed.offsetBottom ? null : (first?.offsetBottom ?? 0),
    offsetTop: mixed.offsetTop ? null : (first?.offsetTop ?? 0),
  };

  const isProfile =
    !!annotation?.isProfile || !!annotation?.annotationTemplate?.isProfile;
  const showBasePoint = isProfile && count === 1;
  const isBasePoint = !!first?.isBasePoint;

  // handlers

  function handleTypeChange(_e, newType) {
    if (!newType) return;
    updateSelectedPoints({ type: newType });
  }

  function handleOffsetBottomChange(updated) {
    updateSelectedPoints({ offsetBottom: updated?.offsetBottom ?? 0 });
  }

  function handleOffsetTopChange(updated) {
    updateSelectedPoints({ offsetTop: updated?.offsetTop ?? 0 });
  }

  function handleBasePointChange(e) {
    if (!first?.id) return;
    setBasePoint(first.id, e.target.checked);
  }

  // render

  if (!count) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 1.25,
        py: 0.25,
        gap: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <ToggleButtonGroup
        value={typeValue}
        exclusive
        size="small"
        onChange={handleTypeChange}
        onMouseDown={(e) => e.stopPropagation()}
        sx={{ flexShrink: 0, "& .MuiToggleButton-root": { p: 0.5 } }}
      >
        <ToggleButton value="square">
          <Tooltip title="Carré">
            <SquareIcon sx={{ fontSize: 16 }} />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="circle">
          <Tooltip title="Cercle">
            <CircleIcon sx={{ fontSize: 16 }} />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      <Tooltip title="Décalage bas (m)">
        <Box>
          <FieldAnnotationHeight
            annotation={offsetsRecord}
            field="offsetBottom"
            label="bas"
            onChange={handleOffsetBottomChange}
          />
        </Box>
      </Tooltip>
      <Tooltip title="Décalage haut (m)">
        <Box>
          <FieldAnnotationHeight
            annotation={offsetsRecord}
            field="offsetTop"
            label="haut"
            onChange={handleOffsetTopChange}
          />
        </Box>
      </Tooltip>

      <Box sx={{ flex: 1 }} />

      {showBasePoint && (
        <Tooltip title="Point de référence du profil (ancrage de l'extrusion)">
          <Box sx={{ display: "flex", alignItems: "center", p: 0.5 }}>
            <Typography variant="body2" color="text.secondary" noWrap>
              Réf.
            </Typography>
            <Switch
              size="small"
              checked={isBasePoint}
              onChange={handleBasePointChange}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}
