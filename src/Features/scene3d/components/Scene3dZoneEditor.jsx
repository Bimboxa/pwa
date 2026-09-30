import { useEffect, useRef, useState } from "react";
import useMeasure from "react-use-measure";

import {
  Box,
  Divider,
  IconButton,
  Paper,
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CropSquare as RectangleIcon,
  Timeline as PolygonIcon,
  RotateLeft as RotateLeftIcon,
  RotateRight as RotateRightIcon,
  SelectAll as AllIcon,
} from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import {
  previewPxToScan,
  scanToPreviewPx,
} from "../utils/scene3dZoneTransform";
import { getScene3dBboxPolygon } from "../utils/getScene3dBaseMapDescriptor";

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 40;
const FIT_MARGIN_PX = 48;
const CLOSE_POLYGON_PX = 12;

// SVG rotate(): clockwise on screen (y down).
function rotateScreen([x, y], deg) {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [x * cos - y * sin, x * sin + y * cos];
}

function getBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return { minX, minY, maxX, maxY };
}

// Zone of interest of a scan base map, drawn on the whole-scan preview
// (top-down bake, image top = scan +Y).
//
// The preview is shown rotated by `rotationDeg` (φ, SVG clockwise) about
// its centre; the zone is drawn in the axis-aligned CONTENT frame (px, y
// down, origin at the preview centre) — that frame is the frame of the
// future base map image: `scene3d.zone.rotationDeg` = φ (see the
// scene3dZoneTransform test). The polygon is kept in the SCAN frame, so
// rotating the preview after drawing keeps it attached to the scan.
//
// value: {rotationDeg, polygonScan: [[x, y], …] | null (whole scan)}
// bbox / pxPerMeter / previewSize: the preview geometry.
export default function Scene3dZoneEditor({
  previewUrl,
  previewSize,
  bbox,
  pxPerMeter,
  value,
  onChange,
}) {
  const svgRef = useRef(null);
  const contentRef = useRef(null);
  const [containerRef, bounds] = useMeasure();

  // strings

  const rectangleS = "Rectangle";
  const polygonS = "Polygone";
  const allS = "Tout le scan";
  const rotationS = "Rotation";
  const hintRectangleS = "Cliquer-glisser pour tracer le rectangle.";
  const hintPolygonS =
    "Cliquer pour ajouter un sommet, double-clic ou Entrée pour fermer, Échap pour annuler.";
  const hintIdleS =
    "Glisser pour déplacer, molette pour zoomer. Tournez le scan puis tracez la zone.";

  // data

  const phi = value?.rotationDeg ?? 0;
  const polygonScan = value?.polygonScan ?? null;
  const w = previewSize?.width ?? 1;
  const h = previewSize?.height ?? 1;

  // state

  const [view, setView] = useState(null); // {zoom, panX, panY}
  const [tool, setTool] = useState(null); // "RECTANGLE" | "POLYGON" | null
  const [draft, setDraft] = useState(null); // content px points
  const [rectStart, setRectStart] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [rotationInput, setRotationInput] = useState(String(phi));
  const panRef = useRef(null);

  // helpers — frames

  const scanToContent = (p) => {
    const [ix, iy] = scanToPreviewPx(bbox, pxPerMeter, p);
    return rotateScreen([ix - w / 2, iy - h / 2], phi);
  };
  const contentToScan = (c) => {
    const [ix, iy] = rotateScreen(c, -phi);
    return previewPxToScan(bbox, pxPerMeter, [ix + w / 2, iy + h / 2]);
  };

  const effectivePolygonScan = polygonScan ?? getScene3dBboxPolygon(bbox);
  const polygonContent = effectivePolygonScan.map(scanToContent);
  const zoneRect = getBounds(polygonContent);

  const containerW = bounds.width || 1;
  const containerH = bounds.height || 1;

  // initial fit (once the container is measured)
  useEffect(() => {
    if (view || !bounds.width || !bounds.height) return;
    const diagonal = Math.hypot(w, h);
    const zoom = Math.min(
      (bounds.width - FIT_MARGIN_PX) / diagonal,
      (bounds.height - FIT_MARGIN_PX) / diagonal
    );
    setView({ zoom: Math.max(MIN_ZOOM, zoom), panX: 0, panY: 0 });
  }, [bounds.width, bounds.height, view, w, h]);

  useEffect(() => {
    setRotationInput(String(Math.round(phi * 10) / 10));
  }, [phi]);

  // helpers — pointer → content px (through the content group's CTM)

  function getContentPoint(event) {
    const g = contentRef.current;
    const svg = svgRef.current;
    if (!g || !svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const local = pt.matrixTransform(g.getScreenCTM().inverse());
    return [local.x, local.y];
  }

  function getSvgPoint(event) {
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  function commitPolygon(pointsContent) {
    if (pointsContent.length < 3) return;
    onChange?.({
      rotationDeg: phi,
      polygonScan: pointsContent.map(contentToScan),
    });
    setDraft(null);
    setRectStart(null);
    setTool(null);
  }

  function setRotation(next) {
    let deg = Number(next);
    if (!Number.isFinite(deg)) return;
    deg = ((((deg + 180) % 360) + 360) % 360) - 180;
    onChange?.({ rotationDeg: deg, polygonScan });
  }

  // handlers — view

  function handleWheel(event) {
    if (!view) return;
    event.preventDefault();
    const [mx, my] = getSvgPoint(event);
    const factor = Math.exp(-event.deltaY * 0.0015);
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
    // keep the content point under the cursor in place
    const cx = mx - containerW / 2;
    const cy = my - containerH / 2;
    const contentX = (cx - view.panX) / view.zoom;
    const contentY = (cy - view.panY) / view.zoom;
    setView({
      zoom,
      panX: cx - contentX * zoom,
      panY: cy - contentY * zoom,
    });
  }

  function handlePointerDown(event) {
    if (!view) return;
    const isPanButton = event.button === 1 || event.button === 2;
    const point = getContentPoint(event);
    if (!point) return;

    if (tool === "RECTANGLE" && event.button === 0) {
      setRectStart(point);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === "POLYGON" && event.button === 0) {
      const points = draft ?? [];
      const first = points[0];
      if (
        first &&
        points.length >= 3 &&
        Math.hypot(point[0] - first[0], point[1] - first[1]) * view.zoom <
          CLOSE_POLYGON_PX
      ) {
        commitPolygon(points);
        return;
      }
      setDraft([...points, point]);
      return;
    }
    if (event.button === 0 || isPanButton) {
      const [mx, my] = getSvgPoint(event);
      panRef.current = { mx, my, panX: view.panX, panY: view.panY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event) {
    const point = getContentPoint(event);
    if (point) setCursor(point);
    if (panRef.current) {
      const [mx, my] = getSvgPoint(event);
      setView((v) => ({
        ...v,
        panX: panRef.current.panX + (mx - panRef.current.mx),
        panY: panRef.current.panY + (my - panRef.current.my),
      }));
    }
  }

  function handlePointerUp(event) {
    if (panRef.current) {
      panRef.current = null;
      return;
    }
    if (rectStart) {
      const end = getContentPoint(event);
      if (end) {
        const { minX, minY, maxX, maxY } = getBounds([rectStart, end]);
        if (maxX - minX > 2 && maxY - minY > 2) {
          commitPolygon([
            [minX, minY],
            [maxX, minY],
            [maxX, maxY],
            [minX, maxY],
          ]);
          return;
        }
      }
      setRectStart(null);
    }
  }

  function handleDoubleClick() {
    if (tool === "POLYGON" && draft?.length >= 3) commitPolygon(draft);
  }

  // keyboard: Enter closes the polygon, Escape cancels the draft / tool
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (draft || rectStart) {
          setDraft(null);
          setRectStart(null);
        } else setTool(null);
        event.stopPropagation();
      } else if (event.key === "Enter" && tool === "POLYGON") {
        if (draft?.length >= 3) commitPolygon(draft);
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });

  // render

  const zoom = view?.zoom ?? 1;
  const strokeW = 1.5 / zoom;
  const hint =
    tool === "RECTANGLE"
      ? hintRectangleS
      : tool === "POLYGON"
        ? hintPolygonS
        : hintIdleS;
  const rectDraft = rectStart && cursor ? getBounds([rectStart, cursor]) : null;
  const dimPath =
    `M${-1e6},${-1e6} H${1e6} V${1e6} H${-1e6} Z ` +
    `M${zoneRect.minX},${zoneRect.minY} H${zoneRect.maxX} V${zoneRect.maxY} H${zoneRect.minX} Z`;

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: 1,
        height: 1,
        overflow: "hidden",
        bgcolor: "#2b2b30",
        cursor: tool ? "crosshair" : panRef.current ? "grabbing" : "grab",
      }}
    >
      <svg
        ref={svgRef}
        width={containerW}
        height={containerH}
        style={{ display: "block", touchAction: "none" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {view && (
          <g
            ref={contentRef}
            transform={`translate(${containerW / 2 + view.panX}, ${
              containerH / 2 + view.panY
            }) scale(${view.zoom})`}
          >
            <g transform={`rotate(${phi})`}>
              <image
                href={previewUrl}
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                preserveAspectRatio="none"
                style={{ imageRendering: "auto" }}
              />
              <rect
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={strokeW}
              />
            </g>

            {/* outside the zone rectangle: dimmed */}
            <path
              d={dimPath}
              fill="rgba(0,0,0,0.45)"
              fillRule="evenodd"
              pointerEvents="none"
            />
            {/* zone rectangle = the future base map image */}
            <rect
              x={zoneRect.minX}
              y={zoneRect.minY}
              width={zoneRect.maxX - zoneRect.minX}
              height={zoneRect.maxY - zoneRect.minY}
              fill="none"
              stroke="#ffffff"
              strokeWidth={strokeW}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
              pointerEvents="none"
            />
            {/* the polygon */}
            {polygonScan && (
              <polygon
                points={polygonContent.map((p) => p.join(",")).join(" ")}
                fill="rgba(255, 196, 0, 0.12)"
                stroke="#ffc400"
                strokeWidth={2 / zoom}
                pointerEvents="none"
              />
            )}
            {/* drafts */}
            {rectDraft && (
              <rect
                x={rectDraft.minX}
                y={rectDraft.minY}
                width={rectDraft.maxX - rectDraft.minX}
                height={rectDraft.maxY - rectDraft.minY}
                fill="rgba(255, 196, 0, 0.12)"
                stroke="#ffc400"
                strokeWidth={2 / zoom}
                pointerEvents="none"
              />
            )}
            {draft && (
              <g pointerEvents="none">
                <polyline
                  points={[...draft, cursor ?? draft[draft.length - 1]]
                    .map((p) => p.join(","))
                    .join(" ")}
                  fill="none"
                  stroke="#ffc400"
                  strokeWidth={2 / zoom}
                />
                {draft.map((p, i) => (
                  <circle
                    key={i}
                    cx={p[0]}
                    cy={p[1]}
                    r={(i === 0 ? 6 : 4) / zoom}
                    fill={i === 0 ? "#ffc400" : "#ffffff"}
                    stroke="#ffc400"
                    strokeWidth={1.5 / zoom}
                  />
                ))}
              </g>
            )}
          </g>
        )}
      </svg>

      {/* toolbar */}
      <Paper
        sx={{
          position: "absolute",
          top: 16,
          left: 16,
          p: 1.5,
          width: 280,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <ToggleButtonGroup
          value={tool}
          exclusive
          size="small"
          fullWidth
          onChange={(_e, next) => {
            setTool(next);
            setDraft(null);
            setRectStart(null);
          }}
        >
          <ToggleButton value="RECTANGLE">
            <RectangleIcon fontSize="small" sx={{ mr: 0.5 }} />
            {rectangleS}
          </ToggleButton>
          <ToggleButton value="POLYGON">
            <PolygonIcon fontSize="small" sx={{ mr: 0.5 }} />
            {polygonS}
          </ToggleButton>
        </ToggleButtonGroup>
        <ButtonGeneric
          label={allS}
          size="small"
          variant="outlined"
          startIcon={<AllIcon />}
          disabled={!polygonScan}
          onClick={() => onChange?.({ rotationDeg: phi, polygonScan: null })}
        />
        <Divider />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            {rotationS}
          </Typography>
          <Tooltip title="−90°">
            <IconButton size="small" onClick={() => setRotation(phi - 90)}>
              <RotateLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="+90°">
            <IconButton size="small" onClick={() => setRotation(phi + 90)}>
              <RotateRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <TextField
            size="small"
            value={rotationInput}
            onChange={(e) => setRotationInput(e.target.value)}
            onBlur={() => setRotation(rotationInput)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") setRotation(rotationInput);
            }}
            inputProps={{ style: { width: 48, textAlign: "right" } }}
            InputProps={{ endAdornment: "°" }}
          />
        </Box>
        <Slider
          size="small"
          min={-180}
          max={180}
          step={0.5}
          value={phi}
          onChange={(_e, next) => setRotation(next)}
        />
      </Paper>

      <Typography
        variant="caption"
        sx={{
          position: "absolute",
          bottom: 88,
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.85)",
          bgcolor: "rgba(0,0,0,0.5)",
          px: 1.5,
          py: 0.5,
          borderRadius: 1,
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        {hint}
      </Typography>
    </Box>
  );
}
