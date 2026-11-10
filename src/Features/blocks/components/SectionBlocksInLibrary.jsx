import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, Button, Chip, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";

import db from "App/db/db";

import useBlocks from "../hooks/useBlocks";
import useBlocksBaseMaps from "../hooks/useBlocksBaseMaps";
import useCreateBlock from "../hooks/useCreateBlock";
import useOpenBlocksBaseMap from "../hooks/useOpenBlocksBaseMap";
import usePlaceBlockInstance from "../hooks/usePlaceBlockInstance";
import deleteBlockService from "../services/deleteBlockService";
import DialogBlockLabel from "./DialogBlockLabel";
import ListItemBlockInLibrary from "./ListItemBlockInLibrary";

// « Blocs » category of the library panel: the blocks of the scope (create,
// rename, delete, open their blocks base map) and the blocks base maps of
// the project.
export default function SectionBlocksInLibrary({ search }) {
  const dispatch = useDispatch();

  // strings

  const newBlockS = "Nouveau bloc";
  const createS = "Créer";
  const renameTitleS = "Renommer le bloc";
  const renameS = "Renommer";
  const emptyS =
    "Aucun bloc. Créez un bloc, dessinez ses annotations sur le fond de plan de blocs, puis liez-les au bloc depuis leur barre d'édition.";
  const noMatchS = "Aucun bloc trouvé.";
  const baseMapsS = "Fonds de plan de blocs";
  const newBaseMapS = "Nouveau";
  const placeOnBlocksBaseMapS =
    "Ouvrez un fond de plan du projet pour y positionner le bloc.";

  // data

  const blocks = useBlocks();
  const blocksBaseMaps = useBlocksBaseMaps();
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const createBlock = useCreateBlock();
  const openBlocksBaseMap = useOpenBlocksBaseMap();
  const placeBlockInstance = usePlaceBlockInstance();

  // state

  const [openCreate, setOpenCreate] = useState(false);
  const [blockToRename, setBlockToRename] = useState(null);

  // helpers

  const isOnBlocksBaseMap = (blocksBaseMaps ?? []).some(
    (b) => b.id === selectedBaseMapId
  );

  const filteredBlocks = useMemo(() => {
    const q = (search ?? "").trim().toLowerCase();
    if (!q) return blocks ?? [];
    return (blocks ?? []).filter((b) => b.label?.toLowerCase().includes(q));
  }, [blocks, search]);

  const count = filteredBlocks.length;

  // handlers

  async function handleCreate(label) {
    setOpenCreate(false);
    const block = await createBlock({ label });
    // straight to the page where its annotations are drawn
    if (block) await openBlocksBaseMap({ block });
  }

  function handlePlace(block) {
    // the open blocks base map cannot host instances (no nested blocks)
    if (isOnBlocksBaseMap) {
      dispatch(setToaster({ message: placeOnBlocksBaseMapS, severity: "info" }));
      return;
    }
    placeBlockInstance(block);
  }

  async function handleRename(label) {
    const block = blockToRename;
    setBlockToRename(null);
    if (block && label !== block.label)
      await db.blocks.update(block.id, { label });
  }

  async function handleDelete(block) {
    await deleteBlockService({ blockId: block.id });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ flexGrow: 1 }}
        >
          {count} bloc{count > 1 ? "s" : ""}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Add />}
          onClick={() => setOpenCreate(true)}
          sx={{ textTransform: "none" }}
        >
          {newBlockS}
        </Button>
      </Box>

      {count === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "center", p: 3 }}
        >
          {(blocks ?? []).length === 0 ? emptyS : noMatchS}
        </Typography>
      ) : (
        filteredBlocks.map((block) => (
          <ListItemBlockInLibrary
            key={block.id}
            block={block}
            onOpen={(b) => openBlocksBaseMap({ block: b })}
            onPlace={handlePlace}
            onRename={setBlockToRename}
            onDelete={handleDelete}
          />
        ))
      )}

      {/* blocks base maps of the project */}
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ display: "block", mt: 1 }}
      >
        {baseMapsS}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {(blocksBaseMaps ?? []).map((baseMap) => {
          const selected = baseMap.id === selectedBaseMapId;
          return (
            <Chip
              key={baseMap.id}
              size="small"
              label={baseMap.name}
              color={selected ? "primary" : "default"}
              variant={selected ? "filled" : "outlined"}
              onClick={() => openBlocksBaseMap({ baseMapId: baseMap.id })}
            />
          );
        })}
        <Chip
          size="small"
          variant="outlined"
          icon={<Add sx={{ fontSize: "14px !important" }} />}
          label={newBaseMapS}
          onClick={() => openBlocksBaseMap({ createNew: true })}
        />
      </Box>

      <DialogBlockLabel
        open={openCreate}
        title={newBlockS}
        submitLabel={createS}
        onClose={() => setOpenCreate(false)}
        onSubmit={handleCreate}
      />
      <DialogBlockLabel
        open={Boolean(blockToRename)}
        title={renameTitleS}
        initialLabel={blockToRename?.label ?? ""}
        submitLabel={renameS}
        onClose={() => setBlockToRename(null)}
        onSubmit={handleRename}
      />
    </Box>
  );
}
