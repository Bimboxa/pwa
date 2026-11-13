import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import {
  CircularProgress,
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
} from "@mui/material";
import { ArrowForward } from "@mui/icons-material";

import IconCreateBaseMap from "Features/icons/IconCreateBaseMap";
import useStartRevolutionAxisTools from "../hooks/useStartRevolutionAxisTools";

const MENU_PAPER_SX = {
  minWidth: 220,
  borderRadius: 2,
  border: "1px solid",
  borderColor: "panel.border",
  mt: 0.5,
};

const DEFAULT_ANCHOR_ORIGIN = { vertical: "bottom", horizontal: "right" };
const DEFAULT_TRANSFORM_ORIGIN = { vertical: "top", horizontal: "right" };

// Menu of the « fond de plan de coupe » button of a plan revolution axis —
// shared by the axis row of PopperMapListings / PanelDrawing
// (RowRevolutionAxis) and by the actions row of the axis edit toolbar
// (RowRevolutionAxisActions), so both buttons offer the same choices:
//
// - « Fonds de plan liés »: the vertical base maps the axis is already placed
//   on — navigation to each one;
// - « Choisir un fond de plan »: the other VERTICAL base maps of the project,
//   grouped by listing — picking one shows it and arms the placement click
//   that links the axis to it (the click creates the placement, which poses
//   that base map in 3D);
// - creation of the automatic A3 coupe page of the axis (`onCreate`, the
//   useCreateRevolutionAxisBaseMap hook of the host): no click, the axis is
//   posed at its base point and the page is selected.
export default function MenuRevolutionAxisBaseMaps({
  anchorEl,
  open,
  onClose,
  axis,
  linkedBaseMaps = [],
  verticalBaseMapGroups = [],
  creating = false,
  onCreate,
  anchorOrigin = DEFAULT_ANCHOR_ORIGIN,
  transformOrigin = DEFAULT_TRANSFORM_ORIGIN,
}) {
  const dispatch = useDispatch();

  // strings

  const linkedS = "Fonds de plan liés";
  const chooseS = "Choisir un fond de plan";
  const noVerticalS = "Aucun fond de plan vertical";
  const createS =
    "Créer le fond de plan de coupe (A3 à l'échelle) et y poser l'axe";

  // data

  const { startPlaceAxis } = useStartRevolutionAxisTools();

  // helpers

  const linkedBaseMapIds = new Set(linkedBaseMaps.map((bm) => bm.id));
  const candidateGroups = (verticalBaseMapGroups ?? [])
    .map((g) => ({
      listing: g.listing,
      baseMaps: g.baseMaps.filter((bm) => !linkedBaseMapIds.has(bm.id)),
    }))
    .filter((g) => g.baseMaps.length > 0);

  // handlers

  const handleGoToBaseMap = (baseMapId) => {
    onClose?.();
    dispatch(setSelectedMainBaseMapId(baseMapId));
  };

  // Linking = showing the vertical base map, then one click on it: the click
  // creates the placement, which poses that base map in 3D.
  const handleLinkBaseMap = (baseMapId) => {
    onClose?.();
    dispatch(setSelectedMainBaseMapId(baseMapId));
    // The plan axis is not on that base map: it does not stay selected.
    dispatch(clearSelection());
    startPlaceAxis(axis);
  };

  const handleCreateBaseMap = () => {
    onClose?.();
    onCreate?.(axis);
  };

  // render

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
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
          <MenuItem key={bm.id} dense onClick={() => handleLinkBaseMap(bm.id)}>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {bm.name}
            </ListItemText>
          </MenuItem>
        )),
      ])}
      <Divider />
      <MenuItem dense onClick={handleCreateBaseMap} disabled={creating}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          {creating ? (
            <CircularProgress size={14} />
          ) : (
            <IconCreateBaseMap sx={{ fontSize: 16 }} />
          )}
        </ListItemIcon>
        <ListItemText primaryTypographyProps={{ variant: "body2" }}>
          {createS}
        </ListItemText>
      </MenuItem>
    </Menu>
  );
}
