import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSoloRevolutionAxisId,
  triggerAnnotationsUpdate,
} from "Features/annotations/annotationsSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import {
  toggleRevolutionAxisHidden,
  toggleRevolutionAxisLinkedHidden,
} from "Features/scopeVisibility/scopeVisibilitySlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Box,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  ArrowForward,
  Contrast,
  FilterCenterFocus,
  HorizontalSplit,
  MoreHoriz,
  PlayArrow,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import IconCreateBaseMap from "Features/icons/IconCreateBaseMap";
import MenuRevolutionAxisBaseMaps from "./MenuRevolutionAxisBaseMaps";
import setRevolutionAxisHalfViewService from "../services/setRevolutionAxisHalfViewService";
import setRevolutionAxisHorizontalCutService from "../services/setRevolutionAxisHorizontalCutService";
import { splitRevolutionAxisProcedures } from "../utils/getRevolutionAxisProcedures";

const MENU_PAPER_SX = {
  minWidth: 220,
  borderRadius: 2,
  border: "1px solid",
  borderColor: "panel.border",
  mt: 0.5,
};

// One row of the "Axes de révolution" section of PopperMapListings — one
// revolution axis drawn on (plan) or placed on (vertical) the current base
// map.
//
// - row click: selects the axis (plan) / its placement (vertical);
// - icon click: SOLO of the axis and everything linked to it;
// - eye (left of the icon): hides / shows the axis — its plan line, its
//   clones on the vertical base maps and the plan footprints (projection on
//   the axis's base map) of what is revolved around it; the revolved
//   annotations themselves and their 3D volumes stay visible (per-scope
//   local state, like the template eyes);
// - count chip: number of annotations revolved around the axis; a toggle —
//   off, those annotations are not shown in 3D (whatever the selected base
//   map) and their plan footprints go in 2D (per-scope local state). On, they
//   also show in 3D when the axis's plan view is the selected base map;
// - half-view: "Demi-vue 3D" of the axis (persisted on the axis, but a view
//   setting anyone may switch — setRevolutionAxisHalfViewService);
// - horizontal cut: hides what is revolved around the axis above a
//   horizontal plane, in 3D; the altitude is dragged on the axis in the 3D
//   view (same contract — setRevolutionAxisHorizontalCutService);
// - arrow / « + » base map: on the plan, goes to the vertical base map the
//   profiles are drawn on — or, when the axis is not linked yet, opens
//   MenuRevolutionAxisBaseMaps (same icon and menu as the axis edit
//   toolbar): pick an existing vertical base map (arms the placement click
//   that links it) or create the automatic A3 coupe page of the axis (no
//   click: the axis is posed at its base point, the page is selected); on a
//   vertical base map, back to the plan;
// - "…" (hover): the systems launched on the axis from a listing « Dessin
//   auto » band (procedureParams[key].listingId) — relaunch of each one
//   (DialogProcedureAxisLaunch on that listing, axis preselected).
export default function RowRevolutionAxis({
  axis,
  placements,
  linkedCount,
  baseMap,
  baseMapById,
  verticalBaseMapGroups,
  procedures,
  spriteImage,
  creatingBaseMap = false,
  onCreateBaseMap,
  onLaunchProcedure,
}) {
  const dispatch = useDispatch();

  // strings

  const selectS = "Sélectionner l'axe";
  const soloS = "Solo";
  const exitSoloS = "Quitter le solo";
  const showS = "Afficher l'axe et ses projections";
  const hideS = "Masquer l'axe et ses projections";
  const halfViewOnS = "Demi-vue 3D (coupe) : activée";
  const halfViewOffS = "Demi-vue 3D (coupe) : désactivée";
  const horizontalCutOnS = "Coupe horizontale 3D : activée";
  const horizontalCutOffS = "Coupe horizontale 3D : désactivée";
  const linkedShownS = "Annotations liées à l'axe : affichées en 3D";
  const linkedHiddenS = "Annotations liées à l'axe : masquées en 3D";
  const goToProfilesS = "Voir le fond de plan des profils";
  const linkS = "Lier un fond de plan pour dessiner les profils";
  const goToPlanS = "Voir la vue en plan de l'axe";
  const moreS = "Plus d'actions";

  // data

  const isSolo = useSelector(
    (s) => s.annotations.soloRevolutionAxisId === axis.id
  );
  const isHidden = useSelector((s) =>
    (s.scopeVisibility.hiddenRevolutionAxisIds ?? []).includes(axis.id)
  );

  const isLinkedHidden = useSelector((s) =>
    (s.scopeVisibility.hiddenLinkedAnnotationsRevolutionAxisIds ?? []).includes(
      axis.id
    )
  );

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [linkMenuAnchor, setLinkMenuAnchor] = useState(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);

  // helpers

  const isOnPlan = axis.baseMapId === baseMap?.id;
  const placementHere = placements.find((p) => p.baseMapId === baseMap?.id);
  const { associated: associatedProcedures } = splitRevolutionAxisProcedures(
    axis,
    procedures
  );
  const isHalfView = axis.halfViewIn3d !== false;
  const isHorizontalCut = axis.horizontalCutIn3d === true;
  const color = axis.strokeColor ?? "#1976d2";
  const planBaseMap = baseMapById[axis.baseMapId];
  const label = axis.label ?? "Axe";
  const planName = isOnPlan ? null : planBaseMap?.name;

  const linkedBaseMaps = placements
    .map((p) => baseMapById[p.baseMapId])
    .filter(Boolean);
  const isMenuOpen = Boolean(linkMenuAnchor || moreMenuAnchor);

  const navigateTitle = !isOnPlan
    ? goToPlanS
    : linkedBaseMaps.length > 0
      ? goToProfilesS
      : linkS;

  // handlers

  const closeMenus = () => {
    setLinkMenuAnchor(null);
    setMoreMenuAnchor(null);
    setIsHovered(false);
  };

  const handleRowClick = () => {
    const target = isOnPlan ? axis : placementHere;
    if (!target) return;
    dispatch(
      setSelectedItem({
        id: target.id,
        nodeId: target.id,
        type: "NODE",
        nodeType: "ANNOTATION",
        annotationType: target.type,
        listingId: target.listingId ?? null,
        annotationTemplateId: target.annotationTemplateId ?? null,
        pointId: null,
        partId: null,
        partType: null,
      })
    );
  };

  const handleToggleSolo = (e) => {
    e.stopPropagation();
    dispatch(setSoloRevolutionAxisId(isSolo ? null : axis.id));
  };

  const handleToggleHidden = (e) => {
    e.stopPropagation();
    dispatch(toggleRevolutionAxisHidden(axis.id));
  };

  const handleToggleHalfView = async (e) => {
    e.stopPropagation();
    await setRevolutionAxisHalfViewService(axis.id, !isHalfView);
    dispatch(triggerAnnotationsUpdate());
  };

  const handleToggleLinkedHidden = (e) => {
    e.stopPropagation();
    dispatch(toggleRevolutionAxisLinkedHidden(axis.id));
  };

  const handleToggleHorizontalCut = async (e) => {
    e.stopPropagation();
    await setRevolutionAxisHorizontalCutService(axis.id, {
      enabled: !isHorizontalCut,
    });
    dispatch(triggerAnnotationsUpdate());
  };

  const handleNavigate = (e) => {
    e.stopPropagation();
    if (!isOnPlan) {
      dispatch(setSelectedMainBaseMapId(axis.baseMapId));
      return;
    }
    if (linkedBaseMaps.length === 1) {
      dispatch(setSelectedMainBaseMapId(linkedBaseMaps[0].id));
      return;
    }
    setLinkMenuAnchor(e.currentTarget);
  };

  const handleOpenMore = (e) => {
    e.stopPropagation();
    setMoreMenuAnchor(e.currentTarget);
  };

  const handleLaunchProcedure = (procedure) => {
    closeMenus();
    onLaunchProcedure?.(axis, procedure);
  };

  // render

  return (
    <>
      <ListItemButton
        onClick={handleRowClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!isMenuOpen) setIsHovered(false);
        }}
        sx={{
          position: "relative",
          bgcolor: isSolo ? alpha(color, 0.12) : "white",
          alignItems: "center",
          justifyContent: "space-between",
          pl: 1,
          pr: 0.5,
          py: 0.5,
          borderLeft: "3px solid",
          borderColor: isHovered || isSolo ? color : "transparent",
          cursor: "pointer",
          "&:hover": { bgcolor: alpha(color, 0.1) },
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}
        >
          {/* Eye — visibility of the axis and its projections */}
          <Tooltip title={isHidden ? showS : hideS} arrow placement="top">
            <IconButton
              size="small"
              onClick={handleToggleHidden}
              sx={{
                p: 0.5,
                mr: 0.25,
                flexShrink: 0,
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
          {/* Icon — click toggles the solo of the axis */}
          <Tooltip title={isSolo ? exitSoloS : soloS} arrow placement="right">
            <Box
              onClick={handleToggleSolo}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                mr: 1,
                flexShrink: 0,
                borderRadius: 1,
                opacity: isHidden ? 0.4 : 1,
                filter: isHidden ? "grayscale(100%)" : "none",
                color: isSolo ? "secondary.main" : "inherit",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              {isSolo ? (
                <FilterCenterFocus sx={{ fontSize: 18 }} />
              ) : (
                <AnnotationTemplateIcon
                  template={{ ...axis, drawingShape: "REVOLUTION_AXIS" }}
                  size={18}
                  spriteImage={spriteImage}
                  revolutionAxisVertical={!isOnPlan}
                />
              )}
            </Box>
          </Tooltip>
          <Tooltip title={selectS} arrow placement="top" enterDelay={800}>
            <Box sx={{ minWidth: 0, userSelect: "none" }}>
              <Typography
                variant="body2"
                color={isHidden ? "text.disabled" : "panel.textPrimary"}
                sx={{
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {label}
              </Typography>
              {planName && (
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
                  {planName}
                </Typography>
              )}
            </Box>
          </Tooltip>
        </Box>

        {/* Right side: linked-annotations chip, actions, then the
            navigation arrow */}
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
          <Tooltip
            title={isLinkedHidden ? linkedHiddenS : linkedShownS}
            arrow
            placement="top"
          >
            <Box
              onClick={handleToggleLinkedHidden}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 22,
                height: 18,
                px: 0.75,
                mr: 0.5,
                borderRadius: "9px",
                border: "1px solid",
                fontSize: "10px",
                fontFamily: "monospace",
                fontWeight: 600,
                lineHeight: 1,
                userSelect: "none",
                cursor: "pointer",
                ...(isLinkedHidden
                  ? {
                      borderColor: "panel.border",
                      bgcolor: "transparent",
                      color: "text.disabled",
                    }
                  : linkedCount > 0
                    ? {
                        borderColor: "secondary.main",
                        bgcolor: "secondary.main",
                        color: "white",
                      }
                    : {
                        borderColor: "secondary.main",
                        bgcolor: "transparent",
                        color: "secondary.main",
                      }),
                "&:hover": { opacity: 0.8 },
              }}
            >
              {linkedCount}
            </Box>
          </Tooltip>
          {associatedProcedures.length > 0 && (
            <Tooltip title={moreS} arrow placement="top">
              <IconButton
                size="small"
                onClick={handleOpenMore}
                sx={{ p: 0.5, color: "panel.iconMuted" }}
              >
                <MoreHoriz sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip
            title={isHalfView ? halfViewOnS : halfViewOffS}
            arrow
            placement="top"
          >
            <IconButton
              size="small"
              onClick={handleToggleHalfView}
              sx={{
                p: 0.5,
                color: isHalfView ? "secondary.main" : "panel.iconMuted",
              }}
            >
              <Contrast sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={isHorizontalCut ? horizontalCutOnS : horizontalCutOffS}
            arrow
            placement="top"
          >
            <IconButton
              size="small"
              onClick={handleToggleHorizontalCut}
              sx={{
                p: 0.5,
                color: isHorizontalCut ? "secondary.main" : "panel.iconMuted",
              }}
            >
              <HorizontalSplit sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={navigateTitle} arrow placement="right">
            <IconButton
              size="small"
              onClick={handleNavigate}
              sx={{
                p: 0.5,
                borderRadius: 1,
                color: color,
                bgcolor: alpha(color, 0.12),
                "&:hover": { bgcolor: color, color: "white" },
              }}
            >
              {isOnPlan && linkedBaseMaps.length === 0 ? (
                <IconCreateBaseMap sx={{ fontSize: 16 }} />
              ) : (
                <ArrowForward
                  sx={{
                    fontSize: 16,
                    transform: isOnPlan ? "none" : "rotate(180deg)",
                  }}
                />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </ListItemButton>

      {/* Linked base maps / link or create a base map (shared with the axis
          edit toolbar) */}
      <MenuRevolutionAxisBaseMaps
        anchorEl={linkMenuAnchor}
        open={Boolean(linkMenuAnchor)}
        onClose={closeMenus}
        axis={axis}
        linkedBaseMaps={linkedBaseMaps}
        verticalBaseMapGroups={verticalBaseMapGroups}
        creating={creatingBaseMap}
        onCreate={onCreateBaseMap}
      />

      {/* Systems launched on the axis: relaunch of each one */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={closeMenus}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: MENU_PAPER_SX } }}
      >
        {associatedProcedures.map((procedure) => (
          <MenuItem
            key={procedure.key}
            dense
            onClick={() => handleLaunchProcedure(procedure)}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <PlayArrow sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {`${procedure.label}…`}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
