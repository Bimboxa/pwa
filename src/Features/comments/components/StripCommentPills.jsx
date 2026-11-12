import { useDispatch, useSelector } from "react-redux";

import { setSelectedCommentListingId } from "../commentsSlice";

import { Box, MenuItem, Select, Tooltip } from "@mui/material";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";

import CommentPill from "./CommentPill";

import { COMMENT_COLORS } from "../commentsDarkTheme";
import openCommentService from "../services/openCommentService";

const STRIP_WIDTH = 44;

// Vertical dark strip of numbered pills at the left of the displayed editor:
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
  const listingsS = "Listes de commentaires";

  // data

  const openedCommentId = useSelector((s) => s.comments.openedCommentId);

  // render

  if (!comments.length && commentListings.length < 2) return null;

  return (
    <Box
      data-capture-hide
      sx={{
        position: "absolute",
        left: 8,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 11,
        width: STRIP_WIDTH,
        maxHeight: "calc(100% - 140px)",
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
              <ForumOutlinedIcon
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
          gap: 0.75,
          py: 1,
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
            onClick={() => openCommentService({ comment, dispatch })}
          />
        ))}
      </Box>
    </Box>
  );
}
