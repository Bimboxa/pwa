import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setBaseMapLinkMenu } from "Features/mapEditor/mapEditorSlice";

import {
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
} from "@mui/material";
import { Check, LinkOff, SwapHoriz } from "@mui/icons-material";

import useVerticalBaseMapsByListing from "../hooks/useVerticalBaseMapsByListing";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import setBaseMapLinkTargetService from "../services/setBaseMapLinkTargetService";
import reverseBaseMapLinkDirectionService from "../services/reverseBaseMapLinkDirectionService";

import db from "App/db/db";

// Menu of the "Lier à un fond de plan" quick action of a BASE_MAP_LINK
// section mark. Redux-driven outlet mounted once in MainMapEditorV3 (like
// DialogChangeAnnotationImage): a MUI Menu rendered from inside the node's
// foreignObject would stay a React descendant of InteractionLayer and its
// backdrop mouseup would deselect the annotation.
//
// The anchor is a screen position captured on the button click — the map
// cannot pan while the modal menu is open, so it never goes stale.
export default function MenuLinkBaseMapOutlet() {
  const dispatch = useDispatch();

  // strings

  const linkedBaseMapS = "Fond de plan lié";
  const noneS = "Aucun fond de plan vertical";
  const reverseS = "Inverser le sens";
  const unlinkS = "Retirer le lien";

  // data

  const menu = useSelector((s) => s.mapEditor.baseMapLinkMenu);
  const annotationId = menu?.annotationId ?? null;
  const annotation = useLiveQuery(
    async () => (annotationId ? db.annotations.get(annotationId) : null),
    [annotationId]
  );
  const { groups } = useVerticalBaseMapsByListing();
  const deleteAnnotations = useDeleteAnnotations();

  // helpers

  const open = Boolean(menu?.anchorPosition && annotationId);
  const linkedBaseMapId = annotation?.linkedBaseMapId ?? null;
  const canReverse = (annotation?.points?.length ?? 0) >= 2;
  const hasBaseMaps = groups.some((g) => g.baseMaps.length > 0);

  // handlers

  const handleClose = () => dispatch(setBaseMapLinkMenu(null));

  const handleSelectBaseMap = async (bm) => {
    handleClose();
    await setBaseMapLinkTargetService({
      linkId: annotationId,
      linkedBaseMapId: bm.id,
      deleteAnnotations,
      dispatch,
    });
  };

  const handleUnlink = async () => {
    handleClose();
    await setBaseMapLinkTargetService({
      linkId: annotationId,
      linkedBaseMapId: null,
      deleteAnnotations,
      dispatch,
    });
  };

  const handleReverse = async () => {
    handleClose();
    await reverseBaseMapLinkDirectionService({
      linkId: annotationId,
      dispatch,
    });
  };

  // render

  return (
    <Menu
      open={open}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={menu?.anchorPosition ?? undefined}
      transformOrigin={{ vertical: "top", horizontal: "center" }}
      slotProps={{
        paper: {
          sx: {
            minWidth: 240,
            maxHeight: 420,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "panel.border",
          },
        },
      }}
    >
      <ListSubheader
        disableSticky
        sx={{ lineHeight: "28px", fontSize: 11, fontWeight: 700 }}
      >
        {linkedBaseMapS}
      </ListSubheader>
      {!hasBaseMaps && (
        <MenuItem disabled dense>
          <ListItemText primaryTypographyProps={{ variant: "body2" }}>
            {noneS}
          </ListItemText>
        </MenuItem>
      )}
      {groups.flatMap((group) => [
        <ListSubheader
          key={`h-${group.listing.id}`}
          disableSticky
          sx={{ lineHeight: "24px", fontSize: 11, color: "text.secondary" }}
        >
          {group.listing.name}
        </ListSubheader>,
        ...group.baseMaps.map((bm) => {
          const isCurrent = bm.id === linkedBaseMapId;
          return (
            <MenuItem
              key={bm.id}
              dense
              selected={isCurrent}
              onClick={() => handleSelectBaseMap(bm)}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {isCurrent && <Check fontSize="small" />}
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ variant: "body2" }}>
                {bm.name}
              </ListItemText>
            </MenuItem>
          );
        }),
      ])}
      <Divider />
      <MenuItem dense disabled={!canReverse} onClick={handleReverse}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <SwapHoriz fontSize="small" />
        </ListItemIcon>
        <ListItemText primaryTypographyProps={{ variant: "body2" }}>
          {reverseS}
        </ListItemText>
      </MenuItem>
      <MenuItem dense disabled={!linkedBaseMapId} onClick={handleUnlink}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <LinkOff fontSize="small" />
        </ListItemIcon>
        <ListItemText primaryTypographyProps={{ variant: "body2" }}>
          {unlinkS}
        </ListItemText>
      </MenuItem>
    </Menu>
  );
}
