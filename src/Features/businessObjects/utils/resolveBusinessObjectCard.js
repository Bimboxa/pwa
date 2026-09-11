import { DEFAULT_BUSINESS_OBJECT_COLOR } from "../constants/businessObjectEntityModel";
import {
  getCardField,
  getEffectiveCardSource,
  parseCardSource,
} from "Features/notesApp/utils/notesAppListingSettings";

import { getBusinessObjectFieldText } from "./businessObjectFieldValues";

// Resolves the "Aperçu de l'objet" of a business object — the Krnet
// `mapCard` preview (avatar + primary + secondary) rendered by the list rows
// when the listing setting `listCard` is on. Port of the mobile app's
// resolveEntityCard / resolveCardText (notes-app src/utils/listingModel.js)
// over the Bimboxa row: field values through businessObjectFieldValues
// (local edits, else the Krnet snapshot), photos under
// `businessObject.notesAppNotes` (media in db.files).
//
// ctx = businessObjectFieldValues ctx + {
//   fields,        // listing.notesApp.settings.fields
//   mapCard,       // getMapCardSetting(settings)
//   listingColor,  // avatar disc fallback color
//   avatarUrl,     // resolved thumbnail of the main photo, or null
// }
//
// Pure module: no React, no Dexie (replayable in node).

export function pickBusinessObjectMainPhotoNote(businessObject) {
  const photos = (businessObject?.notesAppNotes ?? []).filter(
    (n) => n?.type === "photo" && n.fileName
  );
  if (!photos.length) return null;
  const remote = businessObject?.notesAppRemote ?? {};
  const mainId = remote.settings?.mainPhotoNoteId;
  if (mainId) {
    const main = photos.find((n) => n.idMaster === mainId);
    if (main) return main;
  }
  // photos owned by a photo field are not free notes of the object
  const fieldNoteIds = new Set(
    Object.values(remote.fields ?? {}).filter((v) => typeof v === "string")
  );
  return photos.find((n) => !fieldNoteIds.has(n.idMaster)) ?? null;
}

function getName(businessObject) {
  return businessObject?.label ?? businessObject?.notesAppRemote?.name ?? "";
}

function getCode(businessObject) {
  return businessObject?.code ?? businessObject?.notesAppRemote?.code ?? "";
}

export function resolveBusinessObjectCardText(businessObject, src, ctx) {
  if (!src || src === "none") return "";
  if (src === "name") return getName(businessObject);
  if (src === "code") return getCode(businessObject);
  const field = getCardField(ctx?.fields, src);
  if (!field) return "";
  const { mode } = parseCardSource(src);
  return getBusinessObjectFieldText(businessObject, field, ctx, { mode });
}

export default function resolveBusinessObjectCard(
  businessObject,
  ctx,
  { row = true, listingName = "" } = {}
) {
  const fields = ctx?.fields ?? [];
  const mapCard = ctx?.mapCard ?? {};
  const primarySrc = getEffectiveCardSource(fields, "primary", mapCard);
  const secondarySrc = getEffectiveCardSource(fields, "secondary", mapCard);

  const primary =
    String(
      resolveBusinessObjectCardText(businessObject, primarySrc, ctx) || ""
    ).trim() || getName(businessObject);
  const secondaryRaw =
    secondarySrc === "none"
      ? ""
      : String(
          resolveBusinessObjectCardText(businessObject, secondarySrc, ctx) || ""
        ).trim();
  // a list row keeps an empty secondary empty; the map card shows the
  // listing name instead
  const secondary =
    secondaryRaw || (secondarySrc === "none" || row ? "" : listingName || "");

  const initial = (primary.charAt(0) || "?").toUpperCase();
  const color =
    businessObject?.color ?? ctx?.listingColor ?? DEFAULT_BUSINESS_OBJECT_COLOR;
  const avatarUrl = mapCard.avatar === "none" ? null : (ctx?.avatarUrl ?? null);

  return { primary, secondary, initial, color, avatarUrl };
}
