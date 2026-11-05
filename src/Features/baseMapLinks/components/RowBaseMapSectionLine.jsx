import { useState } from "react";
import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Box,
  IconButton,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  GpsFixed,
  Replay,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import IconSectionLine from "Features/icons/IconSectionLine";

import db from "App/db/db";

import { startLocateBaseMapLink } from "../utils/startBaseMapLinkTools";

const DEFAULT_COLOR = "#1976d2";

// One row of the « Traits de coupe » section of PopperMapListings (Fonds de
// plan module, VERTICAL base map): a section mark of the scope, with the
// same look as a revolution-axis row (RowRevolutionAxis).
//
// States, relative to the base map being displayed:
//   - not located: the row and its trailing button arm the locate draw (two
//     clicks) — the commit creates the clone, links the mark to this base
//     map and poses it in 3D;
//   - located HERE: the row selects the clone; the eye toggles the clone's
//     record-level `hidden`; the trailing button re-arms the draw (the
//     commit replaces the clone, so Escape leaves the current one in place);
//   - located on ANOTHER base map: the caption says where; locating it here
//     moves it.
// A mark whose plan has no scale has no length: it cannot be located.
export default function RowBaseMapSectionLine({
  link,
  clone,
  planBaseMap,
  locatedBaseMap,
  lengthM,
  baseMap,
}) {
  const dispatch = useDispatch();

  // strings

  const defaultLabelS = "Coupe";
  const locateS = "Repérer sur ce fond de plan";
  const repositionS = "Repositionner";
  const moveHereS = "Déplacer le repérage ici";
  const selectS = "Sélectionner le repérage";
  const noScaleS = "Le plan d'origine n'a pas d'échelle";
  const showS = "Afficher";
  const hideS = "Masquer";
  const locatedOnS = (name) => `Repéré sur « ${name} »`;

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const isLocatedHere = Boolean(clone) && clone.baseMapId === baseMap?.id;
  const isLocatedElsewhere = Boolean(clone) && !isLocatedHere;
  const isHidden = isLocatedHere && Boolean(clone.hidden);
  const canLocate = lengthM > 0;
  const color = link?.strokeColor ?? DEFAULT_COLOR;
  const label = link?.label || defaultLabelS;
  const actionS = !canLocate
    ? noScaleS
    : isLocatedHere
      ? repositionS
      : isLocatedElsewhere
        ? moveHereS
        : locateS;

  // handlers

  const armLocate = () => {
    if (!canLocate) return;
    setIsHovered(false);
    startLocateBaseMapLink(dispatch, link, { lengthM });
  };

  const selectClone = () => {
    dispatch(
      setSelectedItem({
        id: clone.id,
        nodeId: clone.id,
        type: "NODE",
        nodeType: "ANNOTATION",
        annotationType: "BASE_MAP_LINK",
        listingId: clone.listingId,
        annotationTemplateId: clone.annotationTemplateId,
        pointId: null,
        partId: null,
        partType: null,
      })
    );
  };

  const handleRowClick = () => {
    if (isLocatedHere) selectClone();
    else armLocate();
  };

  const handleLocate = (e) => {
    e.stopPropagation();
    armLocate();
  };

  const handleToggleHidden = async (e) => {
    e.stopPropagation();
    if (!isLocatedHere) return;
    await db.annotations.update(clone.id, { hidden: !clone.hidden });
    dispatch(triggerAnnotationsUpdate());
  };

  // render

  return (
    <ListItemButton
      onClick={handleRowClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: "relative",
        bgcolor: "white",
        alignItems: "center",
        justifyContent: "space-between",
        pl: 1,
        pr: 0.5,
        py: 0.5,
        borderLeft: "3px solid",
        borderColor: isHovered || isLocatedHere ? color : "transparent",
        cursor: "pointer",
        "&:hover": { bgcolor: alpha(color, 0.1) },
      }}
    >
      <Tooltip
        title={isLocatedHere ? selectS : actionS}
        arrow
        placement="top"
        enterDelay={800}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              mr: 1,
              flexShrink: 0,
              color,
              opacity: isHidden ? 0.4 : 1,
              filter: isHidden ? "grayscale(100%)" : "none",
            }}
          >
            <IconSectionLine sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ minWidth: 0, userSelect: "none" }}>
            <Typography
              variant="body2"
              color={isHidden ? "text.disabled" : "panel.textPrimary"}
              sx={{
                lineHeight: 1.3,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                fontSize: "10px",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {planBaseMap?.name}
            </Typography>
            {isLocatedElsewhere && (
              <Typography
                variant="caption"
                color="warning.main"
                sx={{
                  display: "block",
                  fontSize: "10px",
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {locatedOnS(locatedBaseMap?.name ?? "…")}
              </Typography>
            )}
          </Box>
        </Box>
      </Tooltip>

      {/* Right side: eye (located here), then the locate button */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 0.25,
          ml: 1,
          flexShrink: 0,
        }}
      >
        {isLocatedHere && (
          <Tooltip title={isHidden ? showS : hideS} arrow placement="top">
            <IconButton
              size="small"
              onClick={handleToggleHidden}
              sx={{
                p: 0.5,
                color: isHidden ? "secondary.main" : "panel.iconMuted",
              }}
            >
              {isHidden ? (
                <VisibilityOff sx={{ fontSize: 16 }} />
              ) : (
                <Visibility sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={actionS} arrow placement="right">
          {/* span: a disabled button fires no mouse event for the tooltip */}
          <Box component="span" sx={{ display: "inline-flex" }}>
            <IconButton
              size="small"
              disabled={!canLocate}
              onClick={handleLocate}
              sx={{
                p: 0.5,
                borderRadius: 1,
                color,
                bgcolor: alpha(color, 0.12),
                "&:hover": { bgcolor: color, color: "white" },
              }}
            >
              {isLocatedHere ? (
                <Replay sx={{ fontSize: 16 }} />
              ) : (
                <GpsFixed sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Box>
        </Tooltip>
      </Box>
    </ListItemButton>
  );
}
