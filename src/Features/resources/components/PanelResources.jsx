import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setSelectedResourceId } from "../resourcesSlice";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ContainerFilesSelectorV2 from "Features/files/components/ContainerFilesSelectorV2";

import useResources from "../hooks/useResources";
import useCreateResourcesFromFiles from "../hooks/useCreateResourcesFromFiles";
import ListResources from "./ListResources";
import PanelResourceDetail from "./PanelResourceDetail";

export default function PanelResources() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Ressources";
  const dropS = "Déposer ici des fichiers qui seront utilisés comme ressources";

  // data

  const resources = useResources();
  const createResourcesFromFiles = useCreateResourcesFromFiles();

  // state

  const selectedResourceId = useSelector((s) => s.resources.selectedResourceId);
  const [creating, setCreating] = useState(false);
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire on every child: keep a depth counter so the
  // overlay only closes when the pointer really leaves the panel.
  const dragDepthRef = useRef(0);

  // helpers

  const selectedResource = resources.find((r) => r.id === selectedResourceId);

  // handlers

  function handleClose() {
    dispatch(setSelectedMenuItemKey(null));
  }

  async function handleFilesChange(files) {
    if (!files?.length) return;
    setCreating(true);
    try {
      await createResourcesFromFiles(files);
    } finally {
      setCreating(false);
    }
  }

  function handleDragEnter(e) {
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragging(false);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragging(false);
    const files = [...(e.dataTransfer?.files ?? [])];
    handleFilesChange(files);
  }

  // render - detail

  if (selectedResource) {
    return (
      <PanelResourceDetail
        resource={selectedResource}
        onBack={() => dispatch(setSelectedResourceId(null))}
      />
    );
  }

  // render - list

  return (
    <BoxFlexVStretch
      sx={{ position: "relative" }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <HeaderTitleClose title={titleS} onClose={handleClose} />

      {resources.length === 0 ? (
        <Box sx={{ flexGrow: 1, minHeight: 0, p: 1 }}>
          <ContainerFilesSelectorV2
            callToActionLabel={dropS}
            multiple
            onFilesChange={handleFilesChange}
            loading={creating}
          />
        </Box>
      ) : (
        <>
          <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto" }}>
            <ListResources
              resources={resources}
              onResourceClick={(resource) =>
                dispatch(setSelectedResourceId(resource.id))
              }
            />
          </Box>
          <Box sx={{ height: 150, flexShrink: 0, p: 1 }}>
            <ContainerFilesSelectorV2
              callToActionLabel={dropS}
              multiple
              onFilesChange={handleFilesChange}
              loading={creating}
            />
          </Box>
        </>
      )}

      {dragging && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            m: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.default",
            opacity: 0.92,
            border: "2px dashed",
            borderColor: "secondary.main",
            borderRadius: "12px",
            pointerEvents: "none",
            p: 2,
          }}
        >
          <Typography
            variant="body1"
            color="secondary.main"
            sx={{ textAlign: "center", fontWeight: 500 }}
          >
            {dropS}
          </Typography>
        </Box>
      )}
    </BoxFlexVStretch>
  );
}
