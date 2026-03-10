import { useMemo, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { generateKeyBetween } from "fractional-indexing";

import { setSelectedVersionId } from "Features/baseMapEditor/baseMapEditorSlice";
import {
  selectSelectedItems,
  setSelectedItem,
} from "Features/selection/selectionSlice";

import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Chip,
} from "@mui/material";
import {
  DragIndicator,
  Add as AddIcon,
} from "@mui/icons-material";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";
import db from "App/db/db";

function SortableVersionRow({ version, isSelected, onClick, onDoubleClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: version.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1200 : "auto",
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ListItemButton
        component="div"
        selected={isSelected}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        sx={{ py: 0.5, px: 2 }}
      >
        <ListItemIcon
          {...listeners}
          sx={{ minWidth: 24, mr: 0.5, cursor: "grab" }}
        >
          <DragIndicator fontSize="small" sx={{ opacity: 0.4 }} />
        </ListItemIcon>
        <Avatar
          src={version.image?.thumbnail}
          variant="rounded"
          sx={{ width: 24, height: 24, mr: 1 }}
        />
        <ListItemText
          primary={version.label || "Version"}
          slotProps={{
            primary: {
              variant: "body2",
              noWrap: true,
              fontWeight: version.isActive ? "bold" : "normal",
            },
          }}
        />
        {version.isActive && (
          <Chip
            label="Active"
            size="small"
            color="primary"
            sx={{ height: 18, fontSize: "0.65rem" }}
          />
        )}
      </ListItemButton>
    </div>
  );
}

export default function FieldBaseMapVersions({ baseMap }) {
  const dispatch = useDispatch();

  // data

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const createVersion = useCreateBaseMapVersion();
  const fileInputRef = useRef(null);
  const selectedVersionId = useSelector(
    (s) => s.baseMapEditor.selectedVersionId
  );
  const selectedItems = useSelector(selectSelectedItems);
  const listingId = selectedItems[0]?.listingId;

  const sortedVersions = useMemo(() => {
    if (!baseMap?.versions?.length) return [];
    return [...baseMap.versions].sort((a, b) =>
      (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
    );
  }, [baseMap?.versions]);

  const versionIds = useMemo(
    () => sortedVersions.map((v) => v.id),
    [sortedVersions]
  );

  // handlers

  function handleVersionClick(version) {
    dispatch(setSelectedVersionId(version.id));
    dispatch(
      setSelectedItem({
        id: version.id,
        type: "BASE_MAP_VERSION",
        listingId,
        baseMapId: baseMap.id,
      })
    );
  }

  async function handleActivateVersion(version) {
    if (!baseMap?.id || version.isActive) return;
    const record = await db.baseMaps.get(baseMap.id);
    if (!record?.versions) return;
    const updatedVersions = record.versions.map((v) => ({
      ...v,
      isActive: v.id === version.id,
    }));
    await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    try {
      const record = await db.baseMaps.get(baseMap.id);
      if (!record?.versions) return;

      const sorted = [...record.versions].sort((a, b) =>
        (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
      );

      const oldIdx = sorted.findIndex((v) => v.id === active.id);
      const newIdx = sorted.findIndex((v) => v.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      // Reorder then reassign all fractional indices to handle duplicates
      const reordered = arrayMove(sorted, oldIdx, newIdx);
      const newIndices = {};
      let prev = null;
      for (const v of reordered) {
        const fi = generateKeyBetween(prev, null);
        newIndices[v.id] = fi;
        prev = fi;
      }

      const updatedVersions = record.versions.map((v) => ({
        ...v,
        fractionalIndex: newIndices[v.id] ?? v.fractionalIndex,
      }));
      await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
    } catch (e) {
      console.error("[FieldBaseMapVersions] DnD reorder error:", e);
    }
  }

  function handleAddClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (file && baseMap?.id) {
      await createVersion(baseMap.id, file, {
        label: file.name.replace(/\.[^/.]+$/, ""),
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // render

  if (!sortedVersions.length) return null;

  return (
    <>
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      style={{ display: "none" }}
      onChange={handleFileSelected}
    />
    <Box
      sx={{
        bgcolor: "white",
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          px: 2,
          pt: 1.5,
          pb: 0.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Versions
        </Typography>
        <IconButton size="small" onClick={handleAddClick}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      <DndContext
        id={`field-versions-${baseMap.id}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={versionIds}
          strategy={verticalListSortingStrategy}
        >
          <List dense disablePadding>
            {sortedVersions.map((version) => (
              <SortableVersionRow
                key={version.id}
                version={version}
                isSelected={selectedVersionId === version.id}
                onClick={() => handleVersionClick(version)}
                onDoubleClick={() => handleActivateVersion(version)}
              />
            ))}
          </List>
        </SortableContext>
      </DndContext>
    </Box>
    </>
  );
}
