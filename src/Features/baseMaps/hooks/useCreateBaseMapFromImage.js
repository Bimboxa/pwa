import { nanoid } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setBaseMapClippingIn3d } from "Features/threedEditor/threedEditorSlice";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useEnsureBaseMapListing from "Features/baseMaps/hooks/useEnsureBaseMapListing";
import useTriggerInitialScopeSaveIfNeeded from "Features/remoteScopeConfigurations/hooks/useTriggerInitialScopeSaveIfNeeded";
import useLogAppEvent from "Features/appLog/hooks/useLogAppEvent";

import { getWhitePageImageField } from "Features/baseMaps/utils/createWhitePageImage";

import db from "App/db/db";

/**
 * Creates a baseMap entity from an image File and sets up its version system.
 * Used by the file-drop creator.
 *
 * White page: pass `whitePage: { width, height }` INSTEAD of `file` — no file
 * is stored, the image is synthesized at hydration
 * (baseMaps/utils/createWhitePageImage.js).
 *
 * @returns async ({ file, whitePage, name, listing?, meterByPx?, latLng?, geo?, scene3d?, orientation?, printZone?, source?, selectOnCreate? }) => entity
 *   geo: optional capture provenance ({ mode, crs, bbox, scaleFactor, layer })
 *   scene3d: scan base map descriptor (see docs/baseMaps/SCENE_3D_BASE_MAPS.md);
 *   stored verbatim on the record
 *   orientation: 3D plane orientation ("HORIZONTAL" | "VERTICAL"); wins over
 *   the listing's verticalBaseMaps default
 *   position / angleDeg: optional world-space placement applied at creation
 *   localScan: {resourceId, matrix} of a base map projected from a local
 *   point cloud (localScans/README.md)
 *   key / keyScopeId: stable key of the base map within a scope (a page
 *   created by a configuration or a procedure), so content seeded with keys
 *   can target it whatever its id (Features/comments —
 *   bindSeededCommentsService)
 *   clipping3d: clipping box of the base map used as a 3D clipping plane
 *   (« Plan de coupe », see baseMapClipping/utils/getBaseMapClipping3d.js);
 *   `{ enabled: true }` enables the feature and arms the cut right away
 *   selectOnCreate: pass false to keep the current main base map (e.g. a
 *   procedure creating its output map mid-flow must not switch the view)
 */
export default function useCreateBaseMapFromImage() {
  const dispatch = useDispatch();

  const ensureBaseMapListing = useEnsureBaseMapListing();
  const createEntity = useCreateEntity();
  const triggerInitialSaveIfNeeded = useTriggerInitialScopeSaveIfNeeded();
  const logAppEvent = useLogAppEvent();

  return async function createBaseMapFromImage({
    file,
    whitePage,
    name,
    listing: listingArg,
    meterByPx,
    latLng,
    geo,
    scene3d,
    localScan,
    orientation,
    position,
    angleDeg,
    printZone,
    source = whitePage ? "whitePage" : "image",
    createdFrom,
    key,
    keyScopeId,
    clipping3d,
    triggerInitialSave = true,
    selectOnCreate = true,
  }) {
    // first project listing, created when the project has none yet
    const listing = await ensureBaseMapListing({ listing: listingArg });
    if (!listing) return null;

    const entity = {
      name,
      image: whitePage ? getWhitePageImageField(whitePage) : { file },
      ...(whitePage && { whitePage: {} }),
      meterByPx,
      ...(orientation && { orientation }),
      ...(position && { position }),
      ...(Number.isFinite(angleDeg) && { angleDeg }),
      ...(createdFrom && { createdFrom }),
      ...(key && { key, keyScopeId: keyScopeId ?? null }),
      ...(latLng && { latLng }),
      ...(geo && { geo }),
      ...(scene3d && { scene3d }),
      ...(localScan && { localScan }),
      // Print zone seeded by the creator (blank pages); resolved at read
      // time otherwise.
      ...(printZone && { printZone }),
      ...(clipping3d && { clipping3d }),
    };

    const _entity = await createEntity(entity, { listing });

    // Post-process: set up version system with initial version
    if (_entity?.id) {
      const record = await db.baseMaps.get(_entity.id);
      if (record?.image?.imageSize) {
        await db.baseMaps.update(_entity.id, {
          refWidth: record.image.imageSize.width,
          refHeight: record.image.imageSize.height,
          ...(listing?.verticalBaseMaps && { orientation: "VERTICAL" }),
          ...(orientation && { orientation }),
        });
        await db.baseMapVersions.put({
          id: nanoid(),
          baseMapId: _entity.id,
          projectId: record.projectId,
          listingId: record.listingId,
          label: "Image d'origine",
          fractionalIndex: "a0",
          isActive: true,
          image: record.image,
          transform: { x: 0, y: 0, rotation: 0, scale: 1 },
        });
      }

      // same as the panel switch: enabling the feature arms the cut
      if (clipping3d?.enabled) {
        dispatch(setBaseMapClippingIn3d({ baseMapId: _entity.id, on: true }));
      }

      if (selectOnCreate) dispatch(setSelectedMainBaseMapId(_entity.id));
      if (triggerInitialSave) triggerInitialSaveIfNeeded();

      logAppEvent("BASE_MAP_CREATED", { name, source, size: file?.size });
    }

    return _entity;
  };
}
