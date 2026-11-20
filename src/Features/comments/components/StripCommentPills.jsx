import { useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import {
  setIsLocatingComment,
  setSelectedCommentListingId,
  toggleCommentPinsHidden,
} from "../commentsSlice";

import { Box, Menu, MenuItem, Tooltip, Typography } from "@mui/material";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import CommentPill from "./CommentPill";
import IconButtonResetVisibilityFilters from "./IconButtonResetVisibilityFilters";
import ButtonCountPill from "Features/popperMapListings/components/ButtonCountPill";

import { COMMENT_COLORS } from "../commentsDarkTheme";
import openCommentService from "../services/openCommentService";
import startAddCommentService from "../services/startAddCommentService";

const BAR_HEIGHT = 36;
const PILL_SIZE = 24;
const EDGE_GAP = 8;
const TITLE_MAX_WIDTH = 260;
const BAR_MAX_WIDTH = 720;

// Horizontal dark bar centered at the top of the displayed editor: the title
// of the displayed infos listing (a dropdown at its end picks another one
// when the scope has several), the "refresh" button showing every listing /
// template again, then the row of numbered pills — one per comment of the
// listing, in reading order (scrolls horizontally when it overflows).
// Clicking a pill opens the comment (floating panel) and restores its view
// context. Where infos are written (`canEdit` — every module but the
// Viewer), the bar ends with the two creation buttons: located info (armed
// pick, `canLocate`: modules showing the 2D / 3D editors) and plain info.

// At its very left (`pinsCount` — modules showing the 2D / 3D editors), a
// count chip: the number of located infos the displayed editor shows as
// pins; clicking it hides / shows those pins.

// Round button of the bar's right end.
function StripAddButton({ title, Icon, active, disabled, onClick }) {
  return (
    <Tooltip title={title} arrow placement="bottom">
      {/* span: the tooltip still shows on the disabled button */}
      <Box component="span" sx={{ display: "flex", flexShrink: 0 }}>
        <Box
          component="button"
          type="button"
          disabled={disabled}
          onClick={onClick}
          sx={{
            width: PILL_SIZE,
            height: PILL_SIZE,
            p: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            border: `1px solid ${
              active ? COMMENT_COLORS.accentText : COMMENT_COLORS.borderStrong
            }`,
            bgcolor: active ? COMMENT_COLORS.accent : COMMENT_COLORS.background,
            color: active ? COMMENT_COLORS.accentContrast : COMMENT_COLORS.text,
            cursor: "pointer",
            "&:hover": {
              bgcolor: active
                ? COMMENT_COLORS.accent
                : COMMENT_COLORS.surfaceRaised,
            },
            "&:disabled": {
              color: COMMENT_COLORS.textSecondary,
              cursor: "default",
              bgcolor: COMMENT_COLORS.background,
            },
          }}
        >
          <Icon sx={{ fontSize: 16 }} />
        </Box>
      </Box>
    </Tooltip>
  );
}

export default function StripCommentPills({
  comments,
  commentListings,
  selectedListing,
  canEdit = false,
  canLocate = false,
  pinsCount = null,
  pinsHidden = false,
}) {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const untitledS = "Sans titre";
  const listingFallbackS = "Infos";
  const addLocatedS = "Ajouter une info localisée";
  const addLocatedUnavailableS =
    "Info localisée : disponible dans les modules affichant le plan ou la 3D";
  const addS = "Ajouter une info";
  const hidePinsS = "Masquer les bulles d'infos dans l'éditeur";
  const showPinsS = "Afficher les bulles d'infos dans l'éditeur";

  // data

  const openedCommentId = useSelector((s) => s.comments.openedCommentId);
  const isLocating = useSelector((s) => s.comments.isLocating);

  // state

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  // helpers

  const hasSeveralListings = commentListings.length > 1;

  // handlers

  function handleSelectListing(listingId) {
    setMenuAnchorEl(null);
    dispatch(setSelectedCommentListingId(listingId));
  }

  // armed: a second click disarms the pick (like the toolbar command)
  function handleAddLocated() {
    if (isLocating) {
      dispatch(setIsLocatingComment(false));
      return;
    }
    startAddCommentService({ located: true, dispatch, store });
  }

  function handleAdd() {
    startAddCommentService({ located: false, dispatch, store });
  }

  // a vertical mouse wheel scrolls the pills row
  function handlePillsWheel(e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  }

  // render

  if (!comments.length && !hasSeveralListings && !canEdit) return null;

  return (
    <Box
      data-capture-hide
      sx={{
        position: "absolute",
        // centered at the top of the editor
        top: EDGE_GAP,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 11,
        height: BAR_HEIGHT,
        maxWidth: `min(calc(100% - ${2 * EDGE_GAP}px), ${BAR_MAX_WIDTH}px)`,
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        pl: pinsCount == null ? 0.5 : 1,
        pr: 0.75,
        borderRadius: `${BAR_HEIGHT / 2}px`,
        border: `1px solid ${COMMENT_COLORS.borderStrong}`,
        bgcolor: COMMENT_COLORS.background,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        pointerEvents: "auto",
      }}
    >
      {pinsCount != null && (
        <ButtonCountPill
          count={pinsCount}
          hidden={pinsHidden}
          title={pinsHidden ? showPinsS : hidePinsS}
          onClick={() => dispatch(toggleCommentPinsHidden())}
        />
      )}
      <Box
        component={hasSeveralListings ? "button" : "div"}
        type={hasSeveralListings ? "button" : undefined}
        onClick={
          hasSeveralListings
            ? (e) => setMenuAnchorEl(e.currentTarget)
            : undefined
        }
        sx={{
          flexShrink: 0,
          height: BAR_HEIGHT - 8,
          maxWidth: TITLE_MAX_WIDTH,
          display: "flex",
          alignItems: "center",
          pl: pinsCount == null ? 1.25 : 0.5,
          pr: hasSeveralListings ? 0.25 : 0.5,
          borderRadius: `${(BAR_HEIGHT - 8) / 2}px`,
          border: "none",
          bgcolor: "transparent",
          font: "inherit",
          cursor: hasSeveralListings ? "pointer" : "default",
          ...(hasSeveralListings && {
            "&:hover": { bgcolor: COMMENT_COLORS.surfaceRaised },
          }),
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 600, color: COMMENT_COLORS.text }}
        >
          {selectedListing?.name || listingFallbackS}
        </Typography>
        {hasSeveralListings && (
          <ArrowDropDown
            sx={{ fontSize: 20, color: COMMENT_COLORS.textSecondary }}
          />
        )}
      </Box>

      {comments.length > 0 && (
        <IconButtonResetVisibilityFilters
          size={PILL_SIZE}
          tooltipPlacement="bottom"
        />
      )}

      {hasSeveralListings && (
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={() => setMenuAnchorEl(null)}
        >
          {commentListings.map((listing) => (
            <MenuItem
              key={listing.id}
              dense
              selected={listing.id === selectedListing?.id}
              onClick={() => handleSelectListing(listing.id)}
            >
              {listing.name}
            </MenuItem>
          ))}
        </Menu>
      )}

      {comments.length > 0 && (
        <>
          <Box
            sx={{
              flexShrink: 0,
              width: "1px",
              height: BAR_HEIGHT - 16,
              bgcolor: COMMENT_COLORS.borderStrong,
            }}
          />
          <Box
            onWheel={handlePillsWheel}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              // room for the hover scale / focus ring of the pills
              px: 0.25,
              height: "100%",
              minWidth: 0,
              overflowX: "auto",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {comments.map((comment) => (
              <CommentPill
                key={comment.id}
                num={comment.num}
                title={comment.title || untitledS}
                active={comment.id === openedCommentId}
                size={PILL_SIZE}
                tooltipPlacement="bottom"
                onClick={() => openCommentService({ comment, dispatch })}
              />
            ))}
          </Box>
        </>
      )}

      {canEdit && (
        <>
          <Box
            sx={{
              flexShrink: 0,
              width: "1px",
              height: BAR_HEIGHT - 16,
              bgcolor: COMMENT_COLORS.borderStrong,
            }}
          />
          <StripAddButton
            title={canLocate ? addLocatedS : addLocatedUnavailableS}
            Icon={AddLocationAltOutlinedIcon}
            active={isLocating}
            disabled={!canLocate}
            onClick={handleAddLocated}
          />
          <StripAddButton
            title={addS}
            Icon={InfoOutlinedIcon}
            disabled={isLocating}
            onClick={handleAdd}
          />
        </>
      )}
    </Box>
  );
}
