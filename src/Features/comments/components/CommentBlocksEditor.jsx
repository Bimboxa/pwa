import { useEffect, useRef, useState } from "react";

import { Box, IconButton, InputBase, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import LinkIcon from "@mui/icons-material/Link";
import YouTubeIcon from "@mui/icons-material/YouTube";

import CommentBlocksRenderer from "./CommentBlocksRenderer";

import {
  COMMENT_BLOCK_TYPES,
  createCommentBlock,
} from "../constants/commentBlocks";
import { COMMENT_COLORS } from "../commentsDarkTheme";

import addCommentImageFileService from "../services/addCommentImageFileService";
import parseYoutubeVideoId from "../utils/parseYoutubeVideoId";
import normalizeLinkUrl from "../utils/normalizeLinkUrl";

const COMPOSER_MODES = { TEXT: "TEXT", LINK: "LINK", YOUTUBE: "YOUTUBE" };

const isImageFile = (file) => Boolean(file?.type?.startsWith("image/"));
const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");

// A message that is nothing but one address written with its protocol.
const SINGLE_URL_RE = /^https?:\/\/\S+$/i;

// Block built from what was typed in the composer, or { error }.
// Text mode recognizes a lone address: a YouTube video becomes a YOUTUBE
// block, any other http(s) address a LINK block.
function buildBlockFromInput(mode, raw) {
  const value = raw.trim();
  if (!value) return null;

  if (mode === COMPOSER_MODES.YOUTUBE) {
    const videoId = parseYoutubeVideoId(value);
    return videoId
      ? createCommentBlock(COMMENT_BLOCK_TYPES.YOUTUBE, { url: value, videoId })
      : { error: "Lien YouTube non reconnu" };
  }
  if (mode === COMPOSER_MODES.LINK) {
    return normalizeLinkUrl(value)
      ? createCommentBlock(COMMENT_BLOCK_TYPES.LINK, { url: value })
      : { error: "Adresse non reconnue" };
  }
  if (SINGLE_URL_RE.test(value)) {
    const videoId = parseYoutubeVideoId(value);
    if (videoId)
      return createCommentBlock(COMMENT_BLOCK_TYPES.YOUTUBE, {
        url: value,
        videoId,
      });
    if (normalizeLinkUrl(value))
      return createCommentBlock(COMMENT_BLOCK_TYPES.LINK, { url: value });
  }
  return createCommentBlock(COMMENT_BLOCK_TYPES.TEXT, { markdown: value });
}

// Editor of a comment draft, laid out like a prompt editor:
// - on top, the FLOW: the title then the blocks, one under the other with no
//   frame between them — the draft reads like the published comment. Text is
//   edited in place; hovering a block shows its move / delete actions.
// - at the bottom, the COMPOSER: one input that appends to the flow (Enter;
//   Shift+Enter for a line break), where images can be pasted or dropped, and
//   a row of options under it (image file, link, YouTube video).
// Images are stored as soon as they are added (db.files, comment listing) —
// the draft only holds their file name.
export default function CommentBlocksEditor({
  title,
  blocks,
  onTitleChange,
  onBlocksChange,
  projectId,
  listingId,
}) {
  // strings

  const titleS = "Titre de l'info";
  const textPlaceholderS = "Écrivez, collez ou déposez une image…";
  const linkPlaceholderS = "Collez l'adresse du lien (https://…)";
  const youtubePlaceholderS = "Collez le lien de la vidéo YouTube";
  const captionS = "Légende…";
  const linkLabelS = "Libellé du lien…";
  const addImageS = "Ajouter des images";
  const addLinkS = "Ajouter un lien";
  const addYoutubeS = "Ajouter une vidéo YouTube";
  const sendS = "Ajouter à l'info (Entrée)";
  const hintS = "Entrée pour ajouter · Maj+Entrée pour un saut de ligne";
  const dropS = "Déposez les images ici";
  const moveUpS = "Monter";
  const moveDownS = "Descendre";
  const deleteS = "Supprimer";

  // state

  const fileInputRef = useRef(null);
  const flowRef = useRef(null);
  const inputRef = useRef(null);
  const scrollToEndRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState(COMPOSER_MODES.TEXT);
  const [error, setError] = useState(null);
  const [addingImage, setAddingImage] = useState(false);
  const [dragging, setDragging] = useState(false);

  // helpers

  const items = blocks ?? [];
  // latest blocks for the async image writes (several files, one at a time)
  const itemsRef = useRef(items);
  itemsRef.current = items;

  function appendBlocks(added) {
    if (!added.length) return;
    scrollToEndRef.current = true;
    onBlocksChange([...itemsRef.current, ...added]);
  }

  function updateBlock(id, patch) {
    onBlocksChange(items.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function removeBlock(id) {
    onBlocksChange(items.filter((b) => b.id !== id));
  }

  function moveBlock(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onBlocksChange(next);
  }

  async function addImageFiles(files) {
    const imageFiles = [...(files ?? [])].filter(isImageFile);
    if (!imageFiles.length) return;
    setAddingImage(true);
    try {
      for (const file of imageFiles) {
        const props = await addCommentImageFileService({
          file,
          projectId,
          listingId,
        });
        if (props)
          appendBlocks([createCommentBlock(COMMENT_BLOCK_TYPES.IMAGE, props)]);
      }
    } finally {
      setAddingImage(false);
    }
  }

  // effects

  // Keep the last added block in view.
  useEffect(() => {
    if (!scrollToEndRef.current) return;
    scrollToEndRef.current = false;
    const flow = flowRef.current;
    if (flow) flow.scrollTop = flow.scrollHeight;
  }, [items.length]);

  // handlers

  function handleSubmit() {
    const built = buildBlockFromInput(mode, draft);
    if (!built) return;
    if (built.error) {
      setError(built.error);
      return;
    }
    appendBlocks([built]);
    setDraft("");
    setError(null);
    setMode(COMPOSER_MODES.TEXT);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape" && mode !== COMPOSER_MODES.TEXT) {
      e.stopPropagation();
      handleModeChange(COMPOSER_MODES.TEXT);
    }
  }

  function handleModeChange(nextMode) {
    setMode((current) =>
      current === nextMode ? COMPOSER_MODES.TEXT : nextMode
    );
    setError(null);
    inputRef.current?.focus();
  }

  function handlePaste(e) {
    const files = [...(e.clipboardData?.files ?? [])];
    if (!files.some(isImageFile)) return;
    e.preventDefault();
    addImageFiles(files);
  }

  function handleDragOver(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragging(false);
  }

  function handleDrop(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragging(false);
    addImageFiles(e.dataTransfer.files);
  }

  // render

  const placeholder =
    mode === COMPOSER_MODES.LINK
      ? linkPlaceholderS
      : mode === COMPOSER_MODES.YOUTUBE
        ? youtubePlaceholderS
        : textPlaceholderS;

  const optionButtonSx = (active) => ({
    color: active ? COMMENT_COLORS.accentText : COMMENT_COLORS.textSecondary,
    bgcolor: active ? alpha(COMMENT_COLORS.accent, 0.45) : "transparent",
    "&:hover": { color: COMMENT_COLORS.text },
  });

  return (
    <Box
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* FLOW — title + blocks, no frame between them */}
      <Box
        ref={flowRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 1.75,
          pt: 1.5,
          pb: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <InputBase
          fullWidth
          placeholder={titleS}
          value={title ?? ""}
          onChange={(e) => onTitleChange(e.target.value)}
          sx={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3, p: 0 }}
        />

        {items.map((block, index) => (
          <Box
            key={block.id}
            sx={{
              position: "relative",
              "& .block-actions": { opacity: 0, pointerEvents: "none" },
              "&:hover .block-actions, &:focus-within .block-actions": {
                opacity: 1,
                pointerEvents: "auto",
              },
            }}
          >
            {block.type === COMMENT_BLOCK_TYPES.TEXT && (
              <InputBase
                fullWidth
                multiline
                value={block.markdown ?? ""}
                onChange={(e) =>
                  updateBlock(block.id, { markdown: e.target.value })
                }
                // an emptied paragraph leaves the flow
                onBlur={() => {
                  if (!block.markdown?.trim()) removeBlock(block.id);
                }}
                sx={{ fontSize: 14, lineHeight: 1.6, p: 0 }}
              />
            )}

            {block.type === COMMENT_BLOCK_TYPES.IMAGE && (
              <>
                <CommentBlocksRenderer blocks={[{ ...block, caption: "" }]} />
                <InputBase
                  fullWidth
                  placeholder={captionS}
                  value={block.caption ?? ""}
                  onChange={(e) =>
                    updateBlock(block.id, { caption: e.target.value })
                  }
                  sx={{
                    mt: 0.25,
                    p: 0,
                    fontSize: 12,
                    color: "text.secondary",
                  }}
                />
              </>
            )}

            {block.type === COMMENT_BLOCK_TYPES.LINK && (
              <>
                <CommentBlocksRenderer blocks={[block]} />
                <InputBase
                  fullWidth
                  placeholder={linkLabelS}
                  value={block.label ?? ""}
                  onChange={(e) =>
                    updateBlock(block.id, { label: e.target.value })
                  }
                  sx={{
                    mt: 0.25,
                    p: 0,
                    fontSize: 12,
                    color: "text.secondary",
                  }}
                />
              </>
            )}

            {block.type === COMMENT_BLOCK_TYPES.YOUTUBE && (
              <CommentBlocksRenderer blocks={[block]} />
            )}

            {/* move / delete, shown over the block on hover */}
            <Box
              className="block-actions"
              sx={{
                position: "absolute",
                top: 2,
                right: 2,
                display: "flex",
                borderRadius: 1.5,
                border: `1px solid ${COMMENT_COLORS.borderStrong}`,
                bgcolor: COMMENT_COLORS.surfaceRaised,
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                transition: "opacity 0.12s",
              }}
            >
              <IconButton
                size="small"
                title={moveUpS}
                disabled={index === 0}
                onClick={() => moveBlock(index, -1)}
                sx={{ p: 0.25 }}
              >
                <KeyboardArrowUpIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                size="small"
                title={moveDownS}
                disabled={index === items.length - 1}
                onClick={() => moveBlock(index, 1)}
                sx={{ p: 0.25 }}
              >
                <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                size="small"
                title={deleteS}
                onClick={() => removeBlock(block.id)}
                sx={{ p: 0.25 }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          </Box>
        ))}
      </Box>

      {/* COMPOSER — prompt-like input + options row */}
      <Box sx={{ flexShrink: 0, px: 1.25, pb: 1 }}>
        <Box
          sx={{
            borderRadius: 3,
            border: "1px solid",
            borderColor: dragging
              ? COMMENT_COLORS.accentText
              : error
                ? "error.main"
                : COMMENT_COLORS.borderStrong,
            bgcolor: COMMENT_COLORS.surface,
            transition: "border-color 0.12s",
            "&:focus-within": {
              borderColor: error ? "error.main" : COMMENT_COLORS.textSecondary,
            },
          }}
        >
          <InputBase
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={6}
            placeholder={dragging ? dropS : placeholder}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontSize: 14, lineHeight: 1.5 }}
          />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.25,
              px: 0.75,
              pb: 0.75,
            }}
          >
            <Tooltip title={addImageS} arrow>
              <span>
                <IconButton
                  size="small"
                  disabled={addingImage}
                  onClick={() => fileInputRef.current?.click()}
                  sx={optionButtonSx(false)}
                >
                  <AddIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={addLinkS} arrow>
              <IconButton
                size="small"
                onClick={() => handleModeChange(COMPOSER_MODES.LINK)}
                sx={optionButtonSx(mode === COMPOSER_MODES.LINK)}
              >
                <LinkIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={addYoutubeS} arrow>
              <IconButton
                size="small"
                onClick={() => handleModeChange(COMPOSER_MODES.YOUTUBE)}
                sx={optionButtonSx(mode === COMPOSER_MODES.YOUTUBE)}
              >
                <YouTubeIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Typography
              variant="caption"
              noWrap
              sx={{
                flex: 1,
                minWidth: 0,
                px: 0.75,
                color: error ? "error.main" : COMMENT_COLORS.textSecondary,
                opacity: error ? 1 : 0.7,
              }}
            >
              {error ?? hintS}
            </Typography>
            <Tooltip title={sendS} arrow>
              <span>
                <IconButton
                  size="small"
                  disabled={!draft.trim()}
                  onClick={handleSubmit}
                  sx={{
                    bgcolor: COMMENT_COLORS.accent,
                    color: COMMENT_COLORS.accentContrast,
                    "&:hover": { bgcolor: COMMENT_COLORS.accent },
                    "&.Mui-disabled": {
                      bgcolor: COMMENT_COLORS.surfaceRaised,
                      color: COMMENT_COLORS.textSecondary,
                    },
                  }}
                >
                  <ArrowUpwardIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <Box
        component="input"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          addImageFiles(e.target.files);
          e.target.value = "";
        }}
        sx={{ display: "none" }}
      />
    </Box>
  );
}
