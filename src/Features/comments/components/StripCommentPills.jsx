import { useDispatch, useSelector } from "react-redux";

import { setSelectedCommentListingId } from "../commentsSlice";

import { Box, MenuItem, Select, Tooltip } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import CommentPill from "./CommentPill";

import { COMMENT_COLORS } from "../commentsDarkTheme";
import openCommentService from "../services/openCommentService";

const STRIP_WIDTH = 34;
const PILL_SIZE = 24;
const EDGE_GAP = 8;

// Vertical dark strip of numbered pills in the top-left corner of the
// displayed editor:
// one pill per comment of the displayed listing, in reading order. Clicking a
// pill opens the comment (panel on the right) and restores its view context.
// With several comment listings, the icon on top picks the displayed one.
export default function StripCommentPills({
  comments,
  commentListings,
  selectedListing,
}) {
  const dispatch = useDispatch();

  // strings

  const untitledS = "Sans titre";
  const listingsS = "Listes d'infos";

  // data

  const openedCommentId = useSelector((s) => s.comments.openedCommentId);

  // render

  if (!comments.length && commentListings.length < 2) return null;

  return (
    <Box
      data-capture-hide
      sx={{
        position: "absolute",
        // top-left corner of the editor
        left: EDGE_GAP,
        top: EDGE_GAP,
        zIndex: 11,
        width: STRIP_WIDTH,
        // stops above the bottom-left buttons of the editor
        maxHeight: `calc(100% - ${EDGE_GAP}px - 100px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        borderRadius: `${STRIP_WIDTH / 2}px`,
        border: `1px solid ${COMMENT_COLORS.borderStrong}`,
        bgcolor: COMMENT_COLORS.background,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        pointerEvents: "auto",
        overflow: "hidden",
      }}
    >
      {commentListings.length > 1 && (
        <Tooltip
          title={selectedListing?.name ?? listingsS}
          placement="right"
          arrow
        >
          <Select
            variant="standard"
            disableUnderline
            value={selectedListing?.id ?? ""}
            onChange={(e) =>
              dispatch(setSelectedCommentListingId(e.target.value))
            }
            renderValue={() => (
              <InfoOutlinedIcon
                sx={{ fontSize: 18, color: COMMENT_COLORS.textSecondary }}
              />
            )}
            IconComponent={() => null}
            sx={{
              flexShrink: 0,
              width: 1,
              borderBottom: `1px solid ${COMMENT_COLORS.border}`,
              "& .MuiSelect-select": {
                display: "flex",
                justifyContent: "center",
                py: 1,
                pr: "0 !important",
              },
            }}
          >
            {commentListings.map((listing) => (
              <MenuItem key={listing.id} value={listing.id}>
                {listing.name}
              </MenuItem>
            ))}
          </Select>
        </Tooltip>
      )}

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.5,
          py: 0.625,
          width: 1,
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
    </Box>
  );
}
