import { useDispatch, useSelector, useStore } from "react-redux";

import {
  setIsLocatingComment,
  setOpenDialogCreateCommentListing,
  setOpenedCommentId,
  setSelectedCommentListingId,
} from "../commentsSlice";

import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";

import db from "App/db/db";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";

import useCommentListings from "../hooks/useCommentListings";
import useComments from "../hooks/useComments";
import useCanEditComments from "../hooks/useCanEditComments";
import openCommentService from "../services/openCommentService";
import startAddCommentService from "../services/startAddCommentService";

// Left drawer of the Comments module: the comment listing (selector + "new
// listing"), the two creation commands and the comments of the listing in
// reading order (number, title, located mark; reorder and delete on hover).
// Clicking a row opens the comment and restores its view context, exactly
// like its pill does for a reader.
export default function PanelComments() {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const titleS = "Commentaires";
  const newListingS = "Nouvelle liste de commentaires";
  const noListingS =
    "Commencez par créer une liste de commentaires : elle regroupe les commentaires qui guideront la lecture du Krto partagé.";
  const createListingS = "Créer une liste";
  const addS = "Commentaire";
  const addLocatedS = "Commentaire localisé";
  const addTitleS = "Ajoute un commentaire avec la vue affichée";
  const addLocatedTitleS =
    "Ajoute un commentaire épinglé sur un point du plan ou de la vue 3D";
  const emptyS =
    "Aucun commentaire. Cadrez la vue (2D ou 3D), puis ajoutez un commentaire : il mémorise le contexte de visualisation.";
  const untitledS = "Sans titre";
  const locatedS = "Localisé";
  const moveUpS = "Monter";
  const moveDownS = "Descendre";
  const deleteS = "Supprimer";
  const deleteConfirmS = "Supprimer ce commentaire ?";

  // data

  const { commentListings, selectedListing, loading } = useCommentListings();
  const comments = useComments({ listingId: selectedListing?.id });
  const canEdit = useCanEditComments();
  const openedCommentId = useSelector((s) => s.comments.openedCommentId);
  const isLocating = useSelector((s) => s.comments.isLocating);

  // handlers

  function handleAdd(located) {
    // a second click on the armed "located" button disarms the pick
    if (located && isLocating) {
      dispatch(setIsLocatingComment(false));
      return;
    }
    startAddCommentService({ located, dispatch, store });
  }

  async function handleMove(index, delta) {
    const a = comments[index];
    const b = comments[index + delta];
    if (!a || !b) return;
    await db.transaction("rw", db.comments, async () => {
      await db.comments.update(a.id, { sortIndex: b.sortIndex });
      await db.comments.update(b.id, { sortIndex: a.sortIndex });
    });
  }

  async function handleDelete(comment) {
    if (!window.confirm(deleteConfirmS)) return;
    await db.comments.delete(comment.id);
    if (comment.id === openedCommentId) dispatch(setOpenedCommentId(null));
  }

  // render

  return (
    <BoxFlexVStretch sx={{ height: 1 }}>
      <LeftDrawerPanelHeader title={titleS} />

      {!loading && !selectedListing && (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
            {noListingS}
          </Typography>
          {canEdit && (
            <Button
              variant="contained"
              size="small"
              startIcon={<PlaylistAddIcon />}
              onClick={() => dispatch(setOpenDialogCreateCommentListing(true))}
            >
              {createListingS}
            </Button>
          )}
        </Box>
      )}

      {selectedListing && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 2,
              py: 1,
            }}
          >
            <Select
              size="small"
              fullWidth
              value={selectedListing.id}
              onChange={(e) =>
                dispatch(setSelectedCommentListingId(e.target.value))
              }
              sx={{ minWidth: 0, flex: 1 }}
            >
              {commentListings.map((listing) => (
                <MenuItem key={listing.id} value={listing.id}>
                  {listing.name}
                </MenuItem>
              ))}
            </Select>
            {canEdit && (
              <Tooltip title={newListingS} arrow>
                <IconButton
                  size="small"
                  onClick={() =>
                    dispatch(setOpenDialogCreateCommentListing(true))
                  }
                >
                  <PlaylistAddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {canEdit && (
            <Box sx={{ display: "flex", gap: 1, px: 2, pb: 1 }}>
              <Tooltip title={addLocatedTitleS} arrow>
                <Button
                  variant={isLocating ? "contained" : "outlined"}
                  size="small"
                  startIcon={<AddLocationAltOutlinedIcon />}
                  onClick={() => handleAdd(true)}
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  {addLocatedS}
                </Button>
              </Tooltip>
              <Tooltip title={addTitleS} arrow>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => handleAdd(false)}
                >
                  {addS}
                </Button>
              </Tooltip>
            </Box>
          )}

          <BoxFlexVStretch sx={{ overflow: "auto" }}>
            {!comments.length && (
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", px: 2, py: 1 }}
              >
                {emptyS}
              </Typography>
            )}
            <List dense disablePadding>
              {comments.map((comment, index) => {
                const opened = comment.id === openedCommentId;
                return (
                  <ListItemButton
                    key={comment.id}
                    selected={opened}
                    onClick={() => openCommentService({ comment, dispatch })}
                    sx={{
                      gap: 1,
                      pl: 2,
                      pr: 1,
                      "& .comment-actions": { visibility: "hidden" },
                      "&:hover .comment-actions": { visibility: "visible" },
                    }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        flexShrink: 0,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        bgcolor: opened ? "secondary.main" : "common.black",
                        color: "common.white",
                      }}
                    >
                      {comment.num}
                    </Box>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        color: comment.title ? "text.primary" : "text.disabled",
                      }}
                    >
                      {comment.title || untitledS}
                    </Typography>
                    {comment.location && (
                      <Tooltip title={locatedS} arrow>
                        <PlaceOutlinedIcon
                          sx={{ fontSize: 16, color: "text.secondary" }}
                        />
                      </Tooltip>
                    )}
                    {canEdit && (
                      <Box
                        className="comment-actions"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ display: "flex", alignItems: "center" }}
                      >
                        <IconButton
                          size="small"
                          title={moveUpS}
                          disabled={index === 0}
                          onClick={() => handleMove(index, -1)}
                        >
                          <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          title={moveDownS}
                          disabled={index === comments.length - 1}
                          onClick={() => handleMove(index, 1)}
                        >
                          <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          title={deleteS}
                          onClick={() => handleDelete(comment)}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </BoxFlexVStretch>
        </>
      )}
    </BoxFlexVStretch>
  );
}
