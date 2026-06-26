import { nanoid } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useTriggerInitialScopeSaveIfNeeded from "Features/remoteScopeConfigurations/hooks/useTriggerInitialScopeSaveIfNeeded";
import useLogAppEvent from "Features/appLog/hooks/useLogAppEvent";

import db from "App/db/db";

/**
 * Creates a baseMap entity from an image File and sets up its version system.
 * Used by the file-drop creator.
 *
 * @returns async ({ file, name, listing?, meterByPx?, latLng?, source? }) => entity
 */
export default function useCreateBaseMapFromImage() {
  const dispatch = useDispatch();

  const projectBaseMapListings = useProjectBaseMapListings();
  const createEntity = useCreateEntity();
  const triggerInitialSaveIfNeeded = useTriggerInitialScopeSaveIfNeeded();
  const logAppEvent = useLogAppEvent();

  return async function createBaseMapFromImage({
    file,
    name,
    listing: listingArg,
    meterByPx,
    latLng,
    source = "image",
  }) {
    const listing = listingArg ?? projectBaseMapListings?.[0];
    if (!listing) return null;

    const entity = {
      name,
      image: { file },
      meterByPx,
      ...(latLng && { latLng }),
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

      dispatch(setSelectedMainBaseMapId(_entity.id));
      triggerInitialSaveIfNeeded();

      logAppEvent("BASE_MAP_CREATED", { name, source, size: file?.size });
    }

    return _entity;
  };
}
