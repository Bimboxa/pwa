import { useRef, useState } from "react";

import { Box, Button, IconButton, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import LinkIcon from "@mui/icons-material/Link";
import NotesIcon from "@mui/icons-material/Notes";
import YouTubeIcon from "@mui/icons-material/YouTube";

import {
  COMMENT_BLOCK_TYPES,
  createCommentBlock,
} from "../constants/commentBlocks";
import { COMMENT_COLORS } from "../commentsDarkTheme";

import addCommentImageFileService from "../services/addCommentImageFileService";
import parseYoutubeVideoId from "../utils/parseYoutubeVideoId";
import normalizeLinkUrl from "../utils/normalizeLinkUrl";
import usePhotoImageUrl from "Features/photos/hooks/usePhotoImageUrl";

const BLOCK_LABELS = {
  [COMMENT_BLOCK_TYPES.TEXT]: "Texte",
  [COMMENT_BLOCK_TYPES.IMAGE]: "Image",
  [COMMENT_BLOCK_TYPES.LINK]: "Lien",
  [COMMENT_BLOCK_TYPES.YOUTUBE]: "Vidéo YouTube",
};

function ImagePreview({ fileName }) {
  const url = usePhotoImageUrl(fileName);
  if (!url) return null;
  return (
    <Box
      component="img"
      src={url}
      alt=""
      sx={{
        display: "block",
        width: 1,
        maxHeight: 180,
        objectFit: "contain",
        borderRadius: 1,
        bgcolor: COMMENT_COLORS.background,
      }}
    />
  );
}

// Editor of a comment draft: title, then the blocks in order. Each block is a
// card with its own fields (markdown text, image + caption, link, YouTube
// url), move up / down and delete. Images are stored as soon as they are
// added (db.files, comment listing) — the draft only holds their file name.
// An image pasted anywhere in the editor is appended as an IMAGE block.
export default function CommentBlocksEditor({
  title,
  blocks,
  onTitleChange,
  onBlocksChange,
  projectId,
  listingId,
}) {
  // strings

  const titleS = "Titre";
  const markdownS = "Texte";
  const markdownHelperS =
    "Markdown : **gras**, *italique*, # titre, - liste, [lien](https://…)";
  const captionS = "Légende (optionnelle)";
  const urlS = "Adresse (https://…)";
  const linkLabelS = "Libellé (optionnel)";
  const youtubeUrlS = "Lien de la vidéo YouTube";
  const invalidUrlS = "Adresse non reconnue";
  const invalidYoutubeS = "Lien YouTube non reconnu";
  const emptyS = "Ajoutez un premier bloc : texte, image, lien ou vidéo.";
  const moveUpS = "Monter";
  const moveDownS = "Descendre";
  const deleteS = "Supprimer le bloc";

  // state

  const fileInputRef = useRef(null);
  const [addingImage, setAddingImage] = useState(false);

  // helpers

  const items = blocks ?? [];

  function updateBlock(id, patch) {
    onBlocksChange(items.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function moveBlock(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onBlocksChange(next);
  }

  async function addImageFiles(files) {
    const imageFiles = [...(files ?? [])].filter((f) =>
      f?.type?.startsWith("image/")
    );
    if (!imageFiles.length || addingImage) return;
    setAddingImage(true);
    try {
      const added = [];
      for (const file of imageFiles) {
        const props = await addCommentImageFileService({
          file,
          projectId,
          listingId,
        });
        if (props)
          added.push(createCommentBlock(COMMENT_BLOCK_TYPES.IMAGE, props));
      }
      if (added.length) onBlocksChange([...items, ...added]);
    } finally {
      setAddingImage(false);
    }
  }

  // handlers

  function handleAdd(type) {
    if (type === COMMENT_BLOCK_TYPES.IMAGE) {
      fileInputRef.current?.click();
      return;
    }
    onBlocksChange([...items, createCommentBlock(type)]);
  }

  function handlePaste(e) {
    const files = e.clipboardData?.files;
    if (!files?.length) return;
    if (![...files].some((f) => f.type?.startsWith("image/"))) return;
    e.preventDefault();
    addImageFiles(files);
  }

  // render

  return (
    <Box
      onPaste={handlePaste}
      sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
    >
      <TextField
        fullWidth
        size="small"
        label={titleS}
        value={title ?? ""}
        onChange={(e) => onTitleChange(e.target.value)}
      />

      {!items.length && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {emptyS}
        </Typography>
      )}

      {items.map((block, index) => {
        const linkInvalid =
          block.type === COMMENT_BLOCK_TYPES.LINK &&
          Boolean(block.url?.trim()) &&
          !normalizeLinkUrl(block.url);
        const youtubeInvalid =
          block.type === COMMENT_BLOCK_TYPES.YOUTUBE &&
          Boolean(block.url?.trim()) &&
          !block.videoId;
        return (
          <Box
            key={block.id}
            sx={{
              borderRadius: 1.5,
              border: `1px solid ${COMMENT_COLORS.border}`,
              bgcolor: COMMENT_COLORS.surface,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                pl: 1.25,
                pr: 0.5,
                py: 0.25,
                borderBottom: `1px solid ${COMMENT_COLORS.border}`,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  flex: 1,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {BLOCK_LABELS[block.type] ?? block.type}
              </Typography>
              <IconButton
                size="small"
                title={moveUpS}
                disabled={index === 0}
                onClick={() => moveBlock(index, -1)}
              >
                <ArrowUpwardIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                size="small"
                title={moveDownS}
                disabled={index === items.length - 1}
                onClick={() => moveBlock(index, 1)}
              >
                <ArrowDownwardIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                size="small"
                title={deleteS}
                onClick={() =>
                  onBlocksChange(items.filter((b) => b.id !== block.id))
                }
              >
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>

            <Box
              sx={{ p: 1.25, display: "flex", flexDirection: "column", gap: 1 }}
            >
              {block.type === COMMENT_BLOCK_TYPES.TEXT && (
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  placeholder={markdownS}
                  helperText={markdownHelperS}
                  value={block.markdown ?? ""}
                  onChange={(e) =>
                    updateBlock(block.id, { markdown: e.target.value })
                  }
                />
              )}

              {block.type === COMMENT_BLOCK_TYPES.IMAGE && (
                <>
                  <ImagePreview fileName={block.fileName} />
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={captionS}
                    value={block.caption ?? ""}
                    onChange={(e) =>
                      updateBlock(block.id, { caption: e.target.value })
                    }
                  />
                </>
              )}

              {block.type === COMMENT_BLOCK_TYPES.LINK && (
                <>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={urlS}
                    value={block.url ?? ""}
                    error={linkInvalid}
                    helperText={linkInvalid ? invalidUrlS : undefined}
                    onChange={(e) =>
                      updateBlock(block.id, { url: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={linkLabelS}
                    value={block.label ?? ""}
                    onChange={(e) =>
                      updateBlock(block.id, { label: e.target.value })
                    }
                  />
                </>
              )}

              {block.type === COMMENT_BLOCK_TYPES.YOUTUBE && (
                <TextField
                  fullWidth
                  size="small"
                  placeholder={youtubeUrlS}
                  value={block.url ?? ""}
                  error={youtubeInvalid}
                  helperText={youtubeInvalid ? invalidYoutubeS : undefined}
                  onChange={(e) =>
                    updateBlock(block.id, {
                      url: e.target.value,
                      videoId: parseYoutubeVideoId(e.target.value),
                    })
                  }
                />
              )}
            </Box>
          </Box>
        );
      })}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
        {[
          [COMMENT_BLOCK_TYPES.TEXT, NotesIcon],
          [COMMENT_BLOCK_TYPES.IMAGE, ImageOutlinedIcon],
          [COMMENT_BLOCK_TYPES.LINK, LinkIcon],
          [COMMENT_BLOCK_TYPES.YOUTUBE, YouTubeIcon],
        ].map(([type, Icon]) => (
          <Button
            key={type}
            variant="outlined"
            color="inherit"
            startIcon={
              <Box sx={{ display: "inline-flex", alignItems: "center" }}>
                <AddIcon sx={{ fontSize: 14 }} />
                <Icon sx={{ fontSize: 16 }} />
              </Box>
            }
            disabled={type === COMMENT_BLOCK_TYPES.IMAGE && addingImage}
            onClick={() => handleAdd(type)}
            sx={{ borderColor: COMMENT_COLORS.borderStrong }}
          >
            {BLOCK_LABELS[type]}
          </Button>
        ))}
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
