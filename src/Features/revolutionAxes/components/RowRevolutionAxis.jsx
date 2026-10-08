import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSoloRevolutionAxisId,
  triggerAnnotationsUpdate,
} from "Features/annotations/annotationsSlice";
import { setPendingProcedureLaunch } from "Features/annotationsAuto/annotationsAutoSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { toggleRevolutionAxisHidden } from "Features/scopeVisibility/scopeVisibilitySlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Box,
  Divider,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Add,
  ArrowForward,
  Contrast,
  FilterCenterFocus,
  MoreHoriz,
  PlayArrow,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import useStartRevolutionAxisTools from "../hooks/useStartRevolutionAxisTools";
import setRevolutionAxisHalfViewService from "../services/setRevolutionAxisHalfViewService";
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
// - eye (hover): hides / shows the axis itself only — its plan line and its
//   clones on the vertical base maps; what is revolved around it stays
//   visible (per-scope local state, like the template eyes);
// - half-view (hover): "Demi-vue 3D" of the axis (persisted on the axis, but
//   a view setting anyone may switch — setRevolutionAxisHalfViewService);
// - arrow: on the plan, goes to the vertical base map the profiles are drawn
//   on — or, when the axis is not linked yet, picks / creates one and arms the
//   placement click that links it; on a vertical base map, back to the plan;
// - "…" (hover): the systems of the axis — relaunch of the ones ASSOCIATED
//   to it (params dialog, replace-on-rerun) and "Associer un système…" while
//   some remain available (getRevolutionAxisProcedures).
export default function RowRevolutionAxis({
  axis,
  placements,
  linkedCount,
  baseMap,
  baseMapById,
  verticalBaseMapGroups,
  procedures,
  spriteImage,
  onCreateBaseMap,
  onAssociateSystem,
}) {
  const dispatch = useDispatch();

  // strings

  const selectS = "Sélectionner l'axe";
  const soloS = "Solo";
  const exitSoloS = "Quitter le solo";
  const showS = "Afficher l'axe";
  const hideS = "Masquer l'axe";
  const halfViewOnS = "Demi-vue 3D (coupe) : activée";
  const halfViewOffS = "Demi-vue 3D (coupe) : désactivée";
  const goToProfilesS = "Voir le fond de plan des profils";
  const linkS = "Lier un fond de plan pour dessiner les profils";
  const goToPlanS = "Voir la vue en plan de l'axe";
  const linkedS = "Fonds de plan liés";
  const chooseS = "Choisir un fond de plan";
  const noVerticalS = "Aucun fond de plan vertical";
  const createS = "Créer un fond de plan…";
  const moreS = "Plus d'actions";
  const associateS = "Associer un système…";

  // data

  const isSolo = useSelector(
    (s) => s.annotations.soloRevolutionAxisId === axis.id
  );
  const isHidden = useSelector((s) =>
    (s.scopeVisibility.hiddenRevolutionAxisIds ?? []).includes(axis.id)
  );
  const { startPlaceAxis } = useStartRevolutionAxisTools();

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [linkMenuAnchor, setLinkMenuAnchor] = useState(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);

  // helpers

  const isOnPlan = axis.baseMapId === baseMap?.id;
  const placementHere = placements.find((p) => p.baseMapId === baseMap?.id);
  const { associated: associatedProcedures, available: availableProcedures } =
    splitRevolutionAxisProcedures(axis, procedures);
  const isHalfView = axis.halfViewIn3d !== false;
  const color = axis.strokeColor ?? "#1976d2";
  const planBaseMap = baseMapById[axis.baseMapId];
  const label = isOnPlan
    ? (axis.label ?? "Axe")
    : [axis.label ?? "Axe", planBaseMap?.name].filter(Boolean).join(" · ");

  const linkedBaseMaps = placements
    .map((p) => baseMapById[p.baseMapId])
    .filter(Boolean);
  const linkedBaseMapIds = new Set(linkedBaseMaps.map((bm) => bm.id));
  const candidateGroups = (verticalBaseMapGroups ?? [])
    .map((g) => ({
      listing: g.listing,
      baseMaps: g.baseMaps.filter((bm) => !linkedBaseMapIds.has(bm.id)),
    }))
    .filter((g) => g.baseMaps.length > 0);
  const isMenuOpen = Boolean(linkMenuAnchor || moreMenuAnchor);
  const showActions = isHovered || isMenuOpen;

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

  const handleGoToBaseMap = (baseMapId) => {
    closeMenus();
    dispatch(setSelectedMainBaseMapId(baseMapId));
  };

  // Linking = showing the vertical base map, then one click on it: the click
  // creates the placement, which poses that base map in 3D.
  const handleLinkBaseMap = (baseMapId) => {
    closeMenus();
    dispatch(setSelectedMainBaseMapId(baseMapId));
    startPlaceAxis(axis);
  };

  const handleCreateBaseMap = () => {
    closeMenus();
    onCreateBaseMap?.(axis);
  };

  const handleOpenMore = (e) => {
    e.stopPropagation();
    setMoreMenuAnchor(e.currentTarget);
  };

  const handleLaunchProcedure = (procedure) => {
    closeMenus();
    dispatch(
      setPendingProcedureLaunch({
        procedureKey: procedure.key,
        sourceAnnotationId: axis.id,
      })
    );
  };

  const handleAssociateSystem = () => {
    closeMenus();
    onAssociateSystem?.(axis);
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
          {/* Icon — click toggles the solo of the axis */}
          <Tooltip title={isSolo ? exitSoloS : soloS} arrow placement="left">
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
            <Typography
              variant="body2"
              color={isHidden ? "text.disabled" : "panel.textPrimary"}
              sx={{
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                userSelect: "none",
              }}
            >
              {label}
            </Typography>
          </Tooltip>
        </Box>

        {/* Right side: actions on hover OR count, then the navigation arrow */}
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
          {showActions ? (
            <>
              {procedures.length > 0 && (
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
            </>
          ) : (
            <Typography
              align="right"
              noWrap
              sx={{
                fontSize: "10px",
                minWidth: "32px",
                fontFamily: "monospace",
                fontWeight: 500,
                mr: 0.5,
              }}
              color={
                isHidden
                  ? "text.disabled"
                  : linkedCount > 0
                    ? "secondary.main"
                    : "panel.countEmpty"
              }
            >
              {`${linkedCount} u`}
            </Typography>
          )}
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
                <Add sx={{ fontSize: 16 }} />
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

      {/* Linked base maps / link a base map */}
      <Menu
        anchorEl={linkMenuAnchor}
        open={Boolean(linkMenuAnchor)}
        onClose={closeMenus}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { ...MENU_PAPER_SX, maxHeight: 360 } } }}
      >
        {linkedBaseMaps.length > 0 && (
          <ListSubheader sx={{ lineHeight: "28px" }}>{linkedS}</ListSubheader>
        )}
        {linkedBaseMaps.map((bm) => (
          <MenuItem key={bm.id} dense onClick={() => handleGoToBaseMap(bm.id)}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <ArrowForward sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {bm.name}
            </ListItemText>
          </MenuItem>
        ))}
        {linkedBaseMaps.length > 0 && <Divider />}
        <ListSubheader sx={{ lineHeight: "28px" }}>{chooseS}</ListSubheader>
        {candidateGroups.length === 0 && (
          <MenuItem disabled dense>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {noVerticalS}
            </ListItemText>
          </MenuItem>
        )}
        {candidateGroups.map((group) => [
          candidateGroups.length > 1 && (
            <ListSubheader
              key={`listing-${group.listing.id}`}
              sx={{ lineHeight: "24px", fontSize: "11px" }}
            >
              {group.listing.name}
            </ListSubheader>
          ),
          ...group.baseMaps.map((bm) => (
            <MenuItem
              key={bm.id}
              dense
              onClick={() => handleLinkBaseMap(bm.id)}
            >
              <ListItemText primaryTypographyProps={{ variant: "body2" }}>
                {bm.name}
              </ListItemText>
            </MenuItem>
          )),
        ])}
        <Divider />
        <MenuItem dense onClick={handleCreateBaseMap}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <Add sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: "body2" }}>
            {createS}
          </ListItemText>
        </MenuItem>
      </Menu>

      {/* Systems of the axis: relaunch of the associated ones, association
          of the remaining ones */}
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
        {associatedProcedures.length > 0 && availableProcedures.length > 0 && (
          <Divider />
        )}
        {availableProcedures.length > 0 && (
          <MenuItem dense onClick={handleAssociateSystem}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <Add sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {associateS}
            </ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
