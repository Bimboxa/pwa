import { useMemo } from "react";

import useNotesAppConfig from "Features/notesApp/hooks/useNotesAppConfig";
import useNotesAppListingConfig from "Features/notesApp/hooks/useNotesAppListingConfig";
import {
  getCardField,
  getEffectiveCardSource,
  getMapCardSetting,
  usesListCard,
} from "Features/notesApp/utils/notesAppListingSettings";

import useBusinessObjectAvatarUrls from "./useBusinessObjectAvatarUrls";
import useBusinessObjectFieldsContext from "./useBusinessObjectFieldsContext";
import resolveBusinessObjectCard from "../utils/resolveBusinessObjectCard";

// "Aperçu de l'objet" of the list rows (Krnet listing settings `listCard` +
// `mapCard`): null when the rows keep their default rendering, else
// {getCard(businessObject) -> {primary, secondary, initial, color,
// avatarUrl}}. The resolution context is built ONCE here for the whole
// tree (objects of the listings the slot fields reference, photo
// thumbnails). Every hook runs unconditionally (empty inputs when off).
export default function useBusinessObjectsListCard({
  listing,
  businessObjects,
}) {
  // data

  const notesAppEnabled = useNotesAppConfig()?.enabled === true;
  const config = useNotesAppListingConfig(listing);

  // helpers

  const { settings, fields, stateModelById } = config;
  const enabled = notesAppEnabled && usesListCard(settings);
  const mapCard = useMemo(() => getMapCardSetting(settings), [settings]);

  // fields used by a text slot -> listings to index
  const slotFields = useMemo(
    () =>
      ["primary", "secondary"]
        .map((key) =>
          getCardField(fields, getEffectiveCardSource(fields, key, mapCard))
        )
        .filter(Boolean),
    [fields, mapCard]
  );

  const fieldsCtx = useBusinessObjectFieldsContext({
    fields: slotFields,
    stateModelById,
    enabled,
  });

  const avatarUrlById = useBusinessObjectAvatarUrls(businessObjects, {
    enabled: enabled && mapCard.avatar !== "none",
  });

  const ctx = useMemo(
    () => ({
      ...fieldsCtx,
      fields,
      mapCard,
      listingColor: listing?.color ?? null,
    }),
    [fieldsCtx, fields, mapCard, listing?.color]
  );

  return useMemo(() => {
    if (!enabled) return null;
    return {
      getCard: (businessObject) =>
        resolveBusinessObjectCard(businessObject, {
          ...ctx,
          avatarUrl: avatarUrlById[businessObject.id] ?? null,
        }),
    };
  }, [enabled, ctx, avatarUrlById]);
}
