import { useMemo, useState } from "react";

import {
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import { Add, Check, WidgetsOutlined } from "@mui/icons-material";

import useBlocks from "../hooks/useBlocks";
import useBlocksBaseMaps from "../hooks/useBlocksBaseMaps";
import useCreateBlock from "../hooks/useCreateBlock";
import useSetAnnotationsBlock from "../hooks/useSetAnnotationsBlock";
import useLinkAnnotationsToBlock from "../hooks/useLinkAnnotationsToBlock";
import getBlockLinkRefusal from "../utils/getBlockLinkRefusal";
import { isBlockInstanceAnnotation } from "../utils/blockTypes";
import DialogBlockLabel from "./DialogBlockLabel";

// « Lier à un bloc » chip of the annotation edit toolbars, next to the layer
// chip. Two modes, from the base map the annotations are drawn on:
// - a blocks base map: sets / changes / clears their block
//   (`annotation.blockId`), no geometry change;
// - a regular base map: MOVES them into the block and leaves an instance of
//   the block in place (useLinkAnnotationsToBlock).
export default function ChipBlockLink({ annotations }) {
  // strings

  const linkS = "Lier à un bloc";
  const noneS = "Aucun bloc";
  const newBlockS = "Nouveau bloc…";
  const newBlockTitleS = "Nouveau bloc";
  const createS = "Créer";

  // data

  const blocks = useBlocks();
  const blocksBaseMaps = useBlocksBaseMaps();
  const createBlock = useCreateBlock();
  const setAnnotationsBlock = useSetAnnotationsBlock();
  const linkAnnotationsToBlock = useLinkAnnotationsToBlock();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [openCreate, setOpenCreate] = useState(false);

  // helpers

  const blocksBaseMapIds = useMemo(
    () => new Set((blocksBaseMaps ?? []).map((b) => b.id)),
    [blocksBaseMaps]
  );

  const onBlocksBaseMap =
    annotations?.length > 0 &&
    annotations.every(
      (a) =>
        blocksBaseMapIds.has(a.baseMapId) &&
        !isBlockInstanceAnnotation(a) &&
        !a.isBaseMapAnnotation
    );
  // regular base map: the whole selection must be movable into a block
  const movable =
    !onBlocksBaseMap &&
    blocksBaseMaps !== undefined &&
    annotations?.length > 0 &&
    annotations.every((a) => !blocksBaseMapIds.has(a.baseMapId)) &&
    !getBlockLinkRefusal(annotations);
  const linkable = onBlocksBaseMap || movable;

  const annotationIds = (annotations ?? []).map((a) => a.id);
  const uniqueBlockIds = [
    ...new Set((annotations ?? []).map((a) => a.blockId ?? null)),
  ];
  const isMixed = uniqueBlockIds.length > 1;
  const currentBlockId = isMixed ? null : uniqueBlockIds[0];
  const currentBlock = currentBlockId
    ? blocks?.find((b) => b.id === currentBlockId)
    : null;

  let chipLabel = linkS;
  if (isMixed) chipLabel = `${uniqueBlockIds.length} blocs`;
  else if (currentBlock) chipLabel = currentBlock.label;

  // handlers

  function handleOpen(e) {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleSelect(blockId) {
    handleClose();
    if (movable) {
      if (blockId) await linkAnnotationsToBlock({ annotations, blockId });
      return;
    }
    await setAnnotationsBlock({ annotationIds, blockId });
  }

  function handleNewBlock() {
    handleClose();
    setOpenCreate(true);
  }

  async function handleCreate(label) {
    setOpenCreate(false);
    if (movable) {
      // the block is created with the move (one undo step)
      await linkAnnotationsToBlock({ annotations, newBlockLabel: label });
      return;
    }
    const block = await createBlock({ label });
    if (block) await setAnnotationsBlock({ annotationIds, blockId: block.id });
  }

  // render

  if (!linkable) return null;

  return (
    <>
      <Chip
        size="small"
        variant="outlined"
        color={currentBlock || isMixed ? "primary" : "default"}
        icon={<WidgetsOutlined sx={{ fontSize: "14px !important" }} />}
        label={chipLabel}
        onClick={handleOpen}
        sx={{
          height: 24,
          fontSize: "0.75rem",
          cursor: "pointer",
          "& .MuiChip-label": { px: 0.75 },
          "& .MuiChip-icon": { ml: 0.5 },
        }}
      />

      <Menu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        {onBlocksBaseMap && (
          <MenuItem onClick={() => handleSelect(null)} dense>
            {uniqueBlockIds.includes(null) && (
              <ListItemIcon>
                <Check fontSize="small" />
              </ListItemIcon>
            )}
            <ListItemText inset={!uniqueBlockIds.includes(null)}>
              {noneS}
            </ListItemText>
          </MenuItem>
        )}

        {blocks?.map((block) => {
          const isSelected =
            onBlocksBaseMap && uniqueBlockIds.includes(block.id);
          return (
            <MenuItem
              key={block.id}
              onClick={() => handleSelect(block.id)}
              dense
            >
              {isSelected && (
                <ListItemIcon>
                  <Check fontSize="small" />
                </ListItemIcon>
              )}
              <ListItemText inset={!isSelected}>{block.label}</ListItemText>
            </MenuItem>
          );
        })}

        {(onBlocksBaseMap || blocks?.length > 0) && <Divider />}
        <MenuItem onClick={handleNewBlock} dense>
          <ListItemIcon>
            <Add fontSize="small" />
          </ListItemIcon>
          <ListItemText>{newBlockS}</ListItemText>
        </MenuItem>
      </Menu>

      <DialogBlockLabel
        open={openCreate}
        title={newBlockTitleS}
        submitLabel={createS}
        onClose={() => setOpenCreate(false)}
        onSubmit={handleCreate}
      />
    </>
  );
}
