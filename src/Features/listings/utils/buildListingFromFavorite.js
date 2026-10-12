// ---------------------------------------------------------------------------
// buildListingFromFavorite — turns a favorite listing (localStorage copy, see
// useFavoriteListings) into a listing object ready for useCreateListings:
// `annotationTemplatesLibrary` carries the templates to re-create.
// `override` ({ name, avatarString }) holds the edits made in the preview.
// ---------------------------------------------------------------------------

export default function buildListingFromFavorite(
  fav,
  { projectId, isForBaseMaps, override } = {}
) {
  const avatarString = override
    ? override.avatarString?.trim()
    : fav.avatarString?.trim();

  return {
    name: override?.name?.trim() || fav.name,
    avatarString: avatarString || null,
    projectId,
    canCreateItem: fav.canCreateItem ?? true,
    table: fav.table ?? "entities",
    entityModel: fav.entityModel,
    entityModelKey: fav.entityModelKey,
    color: fav.color,
    iconKey: fav.iconKey,
    showNewAnnotationToolbar: fav.showNewAnnotationToolbar,
    autoNumberAnnotations: fav.autoNumberAnnotations,
    autoNumberPrefix: fav.autoNumberPrefix,
    autoNumberPadStart: fav.autoNumberPadStart,
    annotationTemplatesLibrary: fav.annotationTemplates,
    ...(isForBaseMaps && { isForBaseMaps: true }),
  };
}
