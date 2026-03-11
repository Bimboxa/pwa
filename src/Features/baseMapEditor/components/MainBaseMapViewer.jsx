import { useDispatch, useSelector } from "react-redux";

import { setCreatingInListingId } from "../baseMapEditorSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import MainMapEditorV3 from "Features/mapEditor/components/MainMapEditorV3";
import SectionCreateBaseMapFullscreen from "Features/mapEditor/components/SectionCreateBaseMapFullscreen";
import LeftDrawerPanel from "Features/leftPanel/components/LeftDrawerPanel";

import useListingById from "Features/listings/hooks/useListingById";

import BaseMapTree from "./BaseMapTree";

export default function MainBaseMapViewer() {
  const dispatch = useDispatch();

  // data

  const creatingInListingId = useSelector(
    (s) => s.baseMapEditor.creatingInListingId
  );
  const listing = useListingById(creatingInListingId);

  // helpers

  const treeWidth = 260;
  const isCreating = Boolean(creatingInListingId);

  // handlers

  function handleCloseCreate() {
    dispatch(setCreatingInListingId(null));
  }

  function handleCreated(entity) {
    dispatch(setSelectedMainBaseMapId(entity?.id));
    dispatch(setSelectedBaseMapsListingId(creatingInListingId));
    dispatch(
      setSelectedItem({
        id: entity?.id,
        type: "BASE_MAP",
        listingId: creatingInListingId,
      })
    );
    dispatch(setCreatingInListingId(null));
  }

  // render

  return (
    <Box sx={{ width: 1, height: 1, display: "flex", position: "relative", overflow: "hidden" }}>
      {/* Left column: tree */}
      <LeftDrawerPanel width={treeWidth} viewerKey="BASE_MAPS">
        <BoxFlexVStretch sx={{ height: 1 }}>
          <BoxFlexVStretch sx={{ overflow: "auto" }}>
            <BaseMapTree />
          </BoxFlexVStretch>
        </BoxFlexVStretch>
      </LeftDrawerPanel>

      {/* Center: map editor or create form */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        {isCreating ? (
          <SectionCreateBaseMapFullscreen
            listing={listing}
            showClose
            onClose={handleCloseCreate}
            onCreated={handleCreated}
          />
        ) : (
          <MainMapEditorV3 forViewerKey="BASE_MAPS" />
        )}
      </Box>
    </Box>
  );
}
