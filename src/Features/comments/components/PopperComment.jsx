import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setIsEditingComment, setOpenedCommentId } from "../commentsSlice";

import {
  Box,
  Button,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";

import db from "App/db/db";

import CommentPill from "./CommentPill";
import CommentBlocksRenderer from "./CommentBlocksRenderer";
import CommentBlocksEditor from "./CommentBlocksEditor";
import PanelFooter from "Features/layout/components/PanelFooter";
import getPanelAutoMaxHeight from "Features/layout/utils/getPanelAutoMaxHeight";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import usePanelResize from "Features/layout/hooks/usePanelResize";

import { COMMENT_COLORS } from "../commentsDarkTheme";
import openCommentService from "../services/openCommentService";
import snapshotCommentViewContextService from "../services/snapshotCommentViewContextService";
import updateCommentService, {
  discardDraftImageFilesService,
} from "../services/updateCommentService";

const POPPER_WIDTH = 380;
const RIGHT_GAP = 12;
const TOP = 50;

// Editor body: owns the draft (title + blocks) of ONE comment — remounted
// (key) when another comment is opened.
function CommentEditorBody({ comment, onDone }) {
  // strings

  const saveS = "Enregistrer";
  const cancelS = "Annuler";
  const updateViewS = "Mettre à jour la vue";
  const updateViewTitleS =
    "Remplace le contexte de vue enregistré par la vue affichée";
  const viewUpdatedS = "Vue mise à jour";

  // state

  const [title, setTitle] = useState(comment.title ?? "");
  const [blocks, setBlocks] = useState(comment.blocks ?? []);
  const [saving, setSaving] = useState(false);
  const [viewUpdated, setViewUpdated] = useState(false);

  // handlers

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await updateCommentService({ commentId: comment.id, title, blocks });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    await discardDraftImageFilesService({ comment, draftBlocks: blocks });
    onDone();
  }

  async function handleUpdateView() {
    const viewContext = await snapshotCommentViewContextService();
    await db.comments.update(comment.id, { viewContext });
    setViewUpdated(true);
  }

  // render

  return (
    <>
      {/* flow + composer: the editor owns its scroll area */}
      <CommentBlocksEditor
        title={title}
        blocks={blocks}
        onTitleChange={setTitle}
        onBlocksChange={setBlocks}
        projectId={comment.projectId}
        listingId={comment.listingId}
      />
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.5,
          pb: 1,
        }}
      >
        <Tooltip title={updateViewTitleS} arrow>
          <Button
            color="inherit"
            startIcon={<CenterFocusStrongIcon sx={{ fontSize: 16 }} />}
            onClick={handleUpdateView}
            sx={{ color: "text.secondary" }}
          >
            {viewUpdated ? viewUpdatedS : updateViewS}
          </Button>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" onClick={handleCancel}>
          {cancelS}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saveS}
        </Button>
      </Box>
    </>
  );
}

// ---------------------------------------------------------------------------
// PopperComment — floating dark panel of the opened comment, anchored at the
// RIGHT of the editor box (same shell as PopperImages: draggable header,
// PanelFooter with "auto" + bottom-left resize handle, height capped to the
// editor). Header: number pill + title, previous / next comment, edit and
// delete (Comments module only), close. Body: the blocks, read-only or in
// their editor.
// ---------------------------------------------------------------------------
export default function PopperComment({ comments, canEdit }) {
  const dispatch = useDispatch();

  // strings

  const untitledS = "Sans titre";
  const emptyS = "Cette info n'a pas encore de contenu.";
  const prevS = "Info précédente";
  const nextS = "Info suivante";
  const editS = "Modifier";
  const deleteS = "Supprimer l'info";
  const deleteConfirmS = "Supprimer cette info ?";
  const closeS = "Fermer";
  const locatedS = "Info localisée";

  // data

  const openedCommentId = useSelector((s) => s.comments.openedCommentId);
  const isEditing = useSelector((s) => s.comments.isEditing);
  // The open right tool drawer slides over the editor: step aside.
  const rightDrawerWidth = useSelector((s) =>
    s.rightPanel.selectedMenuItemKey ? s.rightPanel.width : 0
  );

  // state

  const { position, isDragging, handleMouseDown } = usePanelDrag();
  const paperRef = useRef(null);
  const {
    size,
    isAutoHeight,
    handleResizeMouseDown,
    fitContent,
    reset: resetSize,
  } = usePanelResize({
    paperRef,
    minWidth: 280,
    minHeight: 160,
    anchor: "right",
  });

  // helpers

  const index = comments.findIndex((c) => c.id === openedCommentId);
  const comment = index >= 0 ? comments[index] : null;
  const editing = Boolean(isEditing && canEdit);
  const prev = index > 0 ? comments[index - 1] : null;
  const next =
    index >= 0 && index < comments.length - 1 ? comments[index + 1] : null;
  const stop = (e) => e.stopPropagation();

  // handlers

  function handleOpen(target) {
    if (target) openCommentService({ comment: target, dispatch });
  }

  async function handleDelete() {
    if (!comment || !window.confirm(deleteConfirmS)) return;
    await db.comments.delete(comment.id);
    dispatch(setOpenedCommentId(null));
  }

  // render

  if (!comment) return null;

  return (
    <Paper
      ref={paperRef}
      elevation={8}
      data-capture-hide
      sx={{
        position: "absolute",
        top: TOP,
        right: RIGHT_GAP + rightDrawerWidth,
        zIndex: 12,
        width: size?.width ?? POPPER_WIDTH,
        maxWidth: `calc(100% - ${2 * RIGHT_GAP}px)`,
        ...(size
          ? {
              height: size.height,
              maxHeight: isAutoHeight
                ? getPanelAutoMaxHeight({
                    top: `${TOP}px`,
                    offsetY: position.y,
                  })
                : `calc(100% - ${TOP}px)`,
            }
          : {
              maxHeight: getPanelAutoMaxHeight({
                top: `${TOP}px`,
                offsetY: position.y,
              }),
            }),
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 3,
        border: `1px solid ${COMMENT_COLORS.borderStrong}`,
        bgcolor: COMMENT_COLORS.background,
        backgroundImage: "none",
        color: "text.primary",
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging.current
          ? "right 0.15s ease"
          : "transform 0.1s ease-out, right 0.15s ease",
      }}
    >
      {/* Draggable header (whole bar except the controls) */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 1.25,
          pr: 0.5,
          py: 0.75,
          bgcolor: COMMENT_COLORS.surface,
          borderBottom: `1px solid ${COMMENT_COLORS.border}`,
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <CommentPill
          num={comment.num}
          active
          size={26}
          sx={{ cursor: "inherit" }}
        />
        <Typography
          variant="body1"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 600,
            color: comment.title ? "text.primary" : "text.secondary",
          }}
        >
          {comment.title || untitledS}
        </Typography>
        {comment.location && (
          <Tooltip title={locatedS} arrow>
            <PlaceOutlinedIcon
              sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }}
            />
          </Tooltip>
        )}
        <Box onMouseDown={stop} sx={{ display: "flex", alignItems: "center" }}>
          {!editing && (
            <>
              <IconButton
                size="small"
                title={prevS}
                disabled={!prev}
                onClick={() => handleOpen(prev)}
              >
                <ChevronLeftIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton
                size="small"
                title={nextS}
                disabled={!next}
                onClick={() => handleOpen(next)}
              >
                <ChevronRightIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </>
          )}
          {canEdit && !editing && (
            <>
              <IconButton
                size="small"
                title={editS}
                onClick={() => dispatch(setIsEditingComment(true))}
              >
                <EditOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton size="small" title={deleteS} onClick={handleDelete}>
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </>
          )}
          {!editing && (
            <IconButton
              size="small"
              title={closeS}
              onClick={() => dispatch(setOpenedCommentId(null))}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      </Box>

      {editing ? (
        <CommentEditorBody
          key={comment.id}
          comment={comment}
          onDone={() => dispatch(setIsEditingComment(false))}
        />
      ) : (
        <Box sx={{ flex: 1, overflow: "auto", p: 1.75 }}>
          <CommentBlocksRenderer blocks={comment.blocks} emptyLabel={emptyS} />
        </Box>
      )}

      <PanelFooter
        resizeCorner="bottom-left"
        onResizeMouseDown={handleResizeMouseDown}
        onResetSize={resetSize}
        onFitContent={fitContent}
        isAutoHeight={isAutoHeight}
      />
    </Paper>
  );
}
