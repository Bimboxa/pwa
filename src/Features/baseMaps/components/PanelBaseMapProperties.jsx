import { useEffect, useMemo, useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import {
  selectSelectedItems,
  setSelectedItem,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import {
  setSelectedViewerKey,
  setViewerReturnContext,
} from "Features/viewers/viewersSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedBaseMapId,
  setPropertiesRequestedView,
} from "Features/baseMaps/baseMapsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMap from "../hooks/useBaseMap";
import useListingById from "Features/listings/hooks/useListingById";
import useDeleteEntity from "Features/entities/hooks/useDeleteEntity";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import downloadBlob from "Features/files/utils/downloadBlob";
import addBackgroundToImage from "Features/images/utils/addBackgroundToImage";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";
import db from "App/db/db";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ButtonBase,
} from "@mui/material";
import {
  MoreVert as MoreActionsIcon,
  ArrowBack as Back,
  ChevronRight,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import TogglePhotoOrFlattened from "Features/photoPlans/components/TogglePhotoOrFlattened";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldBaseMapOpacity from "./FieldBaseMapOpacity";
import FieldBaseMapVersions from "./FieldBaseMapVersions";
import PanelBaseMapPositionInMainRef from "./PanelBaseMapPositionInMainRef";
import PanelBaseMapTransformInThreed from "Features/threedEditor/components/PanelBaseMapTransformInThreed";
import FieldBaseMapOpacityIn3d from "Features/threedEditor/components/FieldBaseMapOpacityIn3d";

export default function PanelBaseMapProperties() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Libellé";
  const referenceS = "Référence";

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];

  // The panel targets the baseMap referenced by the BASE_MAP selection item
  // (e.g. a plane clicked in the 3D viewer, which does NOT change the main
  // baseMap to avoid reloading the scene). Fallback: the main baseMap (2D
  // BASE_MAPS viewer opens this panel with an empty selection).
  const mainBaseMap = useMainBaseMap();
  const selectedBaseMap = useBaseMap({
    id: selectedItem?.type === "BASE_MAP" ? selectedItem.id : null,
  });
  const baseMap = selectedBaseMap ?? mainBaseMap;

  const baseMapListingRaw = useListingById(baseMap?.listingId);
  const baseMapListing = useMemo(() => {
    if (!baseMapListingRaw) return undefined;
    return { ...baseMapListingRaw, table: "baseMaps" };
  }, [baseMapListingRaw]);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const viewerReturnContext = useSelector((s) => s.viewers.viewerReturnContext);
  // The effective EDITOR key, NOT the module key: both consumers below gate on
  // what is actually DISPLAYED — the opacity slider (3D scene state vs
  // `baseMap.opacity`) and the position editor (live gizmos vs 2D recalage).
  // In the Dessin module with the 3D editor toggled on (T), the module key is
  // still "MAP", which made this panel fall back to its 2D branch in 3D.
  const selectedViewerKey = useSelector(selectEffectiveViewerKey);
  const deleteEntity = useDeleteEntity();
  const updateEntity = useUpdateEntity();

  const activeVersion = baseMap?.getActiveVersion?.();
  const imageSize = baseMap?.getActiveImageSize?.();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const [openDelete, setOpenDelete] = useState(false);
  const [view, setView] = useState("main"); // "main" | "position3d"

  // One-shot view request from the left panel (Position 3D section of the
  // base map detail view, #312): consume it and clear it.
  const requestedView = useSelector((s) => s.baseMaps.propertiesRequestedView);
  useEffect(() => {
    if (!requestedView) return;
    setView(requestedView);
    dispatch(setPropertiesRequestedView(null));
  }, [requestedView, dispatch]);

  // helpers

  const isThreedViewer = isThreedFamilyViewerKey(selectedViewerKey);

  const aspectRatio =
    imageSize?.width && imageSize?.height
      ? (imageSize.width / imageSize.height).toFixed(2)
      : null;
  const fileSizeS = stringifyFileSize(activeVersion?.image?.file?.size);

  // handlers

  function handleBack() {
    // Back from baseMap properties returns to the scope panel. If we drilled in
    // from another viewer (e.g. "Voir le détail"), also restore that viewer.
    dispatch(setSelectedItem({ id: selectedScopeId, type: "SCOPE" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
    if (viewerReturnContext?.fromViewer) {
      dispatch(setSelectedViewerKey(viewerReturnContext.fromViewer));
      dispatch(setViewerReturnContext(null));
    }
  }

  function handleMenuClick(event) {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }

  function handleMenuClose() {
    setAnchorEl(null);
  }

  function handleDelete() {
    setAnchorEl(null);
    setOpenDelete(true);
  }

  async function handleDownloadImage() {
    setAnchorEl(null);
    const imageUrl = baseMap.getUrl();
    if (!imageUrl) return;
    const processedImageFile = await addBackgroundToImage(imageUrl, "#FFFFFF");
    if (processedImageFile) downloadBlob(processedImageFile, baseMap.name);
  }

  // handlers - baseMap name / reference (changeOnBlur fields)

  async function handleNameChange(value) {
    if (!baseMap?.id) return;
    const name = value ?? "";
    if (name === (baseMap.name || "")) return;
    if (baseMap.isDetail) {
      // Detail baseMaps have no listing (listingId null): useUpdateEntity
      // would fall back to the SELECTED listing and write the wrong table.
      await db.baseMaps.update(baseMap.id, { name });
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
    } else {
      await updateEntity(baseMap.id, { name }, { listing: baseMapListing });
    }
  }

  async function handleDetailRefChange(value) {
    if (!baseMap?.id) return;
    const detailRef = (value ?? "").trim() || null;
    if (detailRef === (baseMap.detailRef || null)) return;
    // Direct write: works for any baseMap, listing-less details included.
    await db.baseMaps.update(baseMap.id, { detailRef });
    dispatch(triggerEntitiesTableUpdate("baseMaps"));
  }

  // render

  if (!baseMap) return null;

  if (view === "position3d") {
    // In the 3D viewer, position editing happens live in the scene (transform
    // sections + gizmos); in the 2D editors it goes through the calibration /
    // recalage flow.
    if (isThreedViewer) {
      return (
        <PanelBaseMapTransformInThreed
          baseMap={baseMap}
          onBack={() => setView("main")}
        />
      );
    }
    return (
      <PanelBaseMapPositionInMainRef
        baseMap={baseMap}
        onBack={() => setView("main")}
      />
    );
  }

  const infoParts = [];
  if (aspectRatio) infoParts.push(`r:${aspectRatio}`);
  if (fileSizeS) infoParts.push(fileSizeS);

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 0.5,
          pl: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton onClick={handleBack}>
            <Back />
          </IconButton>
          <Box sx={{ ml: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Fond de plan
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {baseMap.name || "Fond de plan"}
            </Typography>
            {infoParts.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {infoParts.join(" — ")}
              </Typography>
            )}
          </Box>
        </Box>

        <IconButton onClick={handleMenuClick}>
          <MoreActionsIcon />
        </IconButton>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1.5 }}>
        {/* Photo <-> mise à plat quick switch (photoPlans) — self-hiding. */}
        <TogglePhotoOrFlattened baseMap={baseMap} />
        {/* Same "label | field" white sections as the annotation template
            panel. The version label is edited in the version's own panel
            (click a row of the Versions list). */}
        <FieldTextV2
          label={labelS}
          value={baseMap.name || ""}
          onChange={handleNameChange}
          options={{ showAsField: true, changeOnBlur: true, hideMic: true }}
        />
        <FieldTextV2
          label={referenceS}
          value={baseMap.detailRef || ""}
          onChange={handleDetailRefChange}
          options={{
            showAsField: true,
            changeOnBlur: true,
            hideMic: true,
            placeholder: "1, A, ...",
          }}
        />

        <WhiteSectionGeneric>
          {/* In the 3D viewer, the slider/eye drive the 3D scene display
              (session-only), not baseMap.opacity (DB / 2D display). */}
          {isThreedViewer ? (
            <FieldBaseMapOpacityIn3d baseMap={baseMap} />
          ) : (
            <FieldBaseMapOpacity baseMap={baseMap} />
          )}
        </WhiteSectionGeneric>

        <WhiteSectionGeneric>
          <ButtonBase
            onClick={() => setView("position3d")}
            sx={{
              width: 1,
              p: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">Position 3D</Typography>
            <ChevronRight color="action" />
          </ButtonBase>
        </WhiteSectionGeneric>

        <FieldBaseMapVersions baseMap={baseMap} />
      </BoxFlexVStretch>

      <Menu open={menuOpen} anchorEl={anchorEl} onClose={handleMenuClose}>
        <MenuItem onClick={handleDownloadImage}>Télécharger l'image</MenuItem>
        <MenuItem onClick={handleDelete}>Supprimer</MenuItem>
      </Menu>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={async () => {
          await deleteEntity({
            id: baseMap.id,
            // The 3D selection payload has no listingId — fall back to the
            // listing of the displayed baseMap.
            listingId: selectedItem?.listingId ?? baseMapListing?.id,
          });
          dispatch(setSelectedItem({}));
          dispatch(setSelectedBaseMapId(null));
          // Only reset the main baseMap when it is the one being deleted —
          // deleting another baseMap must not reload the scene.
          if (baseMap.id === mainBaseMap?.id) {
            dispatch(setSelectedMainBaseMapId(null));
          }
          setOpenDelete(false);
        }}
      />
    </BoxFlexVStretch>
  );
}
