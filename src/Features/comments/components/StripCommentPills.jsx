import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedCommentListingId } from "../commentsSlice";

import { Box, Menu, MenuItem, Typography } from "@mui/material";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";

import CommentPill from "./CommentPill";
import IconButtonResetVisibilityFilters from "./IconButtonResetVisibilityFilters";

import { COMMENT_COLORS } from "../commentsDarkTheme";
import openCommentService from "../services/openCommentService";

const STRIP_WIDTH = 34;
const PILL_SIZE = 24;
const EDGE_GAP = 8;
const HEADER_HEIGHT = 28;
const HEADER_MAX_WIDTH = 260;

// Top-left corner of the displayed editor: a dark header with the title of
// the displayed infos listing (a dropdown at its end picks another one when
// the scope has several) and the "refresh" button showing every listing /
// template again, then, below them, the vertical strip of numbered
// pills — one per comment of the listing, in reading order. Clicking a pill
// opens the comment (panel on the right) and restores its view context.
export default function StripCommentPills({
  comments,
  commentListings,
  selectedListing,
}) {
  const dispatch = useDispatch();

  // strings

  const untitledS = "Sans titre";
  const listingFallbackS = "Infos";

  // data

  const openedCommentId = useSelector((s) => s.comments.openedCommentId);

  // state

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  // helpers

  const hasSeveralListings = commentListings.length > 1;

  // handlers

  function handleSelectListing(listingId) {
    setMenuAnchorEl(null);
    dispatch(setSelectedCommentListingId(listingId));
  }

  // render

  if (!comments.length && !hasSeveralListings) return null;

  return (
    <Box
      data-capture-hide
      sx={{
        position: "absolute",
        // top-left corner of the editor
        left: EDGE_GAP,
        top: EDGE_GAP,
        zIndex: 11,
        // stops above the bottom-left buttons of the editor
        maxHeight: `calc(100% - ${EDGE_GAP}px - 100px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: `${EDGE_GAP}px`,
        pointerEvents: "none",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
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
            height: HEADER_HEIGHT,
            maxWidth: HEADER_MAX_WIDTH,
            display: "flex",
            alignItems: "center",
            pl: 1.5,
            pr: hasSeveralListings ? 0.5 : 1.5,
            borderRadius: `${HEADER_HEIGHT / 2}px`,
            border: `1px solid ${COMMENT_COLORS.borderStrong}`,
            bgcolor: COMMENT_COLORS.background,
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            pointerEvents: "auto",
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
          <IconButtonResetVisibilityFilters size={HEADER_HEIGHT} />
        )}
      </Box>

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
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.5,
            py: 0.625,
            width: STRIP_WIDTH,
            minHeight: 0,
            borderRadius: `${STRIP_WIDTH / 2}px`,
            border: `1px solid ${COMMENT_COLORS.borderStrong}`,
            bgcolor: COMMENT_COLORS.background,
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            pointerEvents: "auto",
            overflowY: "auto",
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
              onClick={() => openCommentService({ comment, dispatch })}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
