import { generateKeyBetween } from "fractional-indexing";

import useCreateListings from "Features/listings/hooks/useCreateListings";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";
import useCreateBaseMaps from "Features/baseMapCreator/hooks/useCreateBaseMaps";

import createBlankImageFile from "Features/images/utils/createBlankImageFile";
import getBlankBaseMapGeometry from "Features/baseMaps/utils/getBlankBaseMapGeometry";

// configuration pageOrientation -> getBlankBaseMapGeometry format
const FORMAT_BY_PAGE_ORIENTATION = {
  LANDSCAPE: "paysage",
  PORTRAIT: "portrait",
  SQUARE: "carre",
};

/*
 * Create the baseMap listings (and their BLANK_PAGE / ASSET baseMap items)
 * declared by a Krto creation configuration (configuration.baseMaps.listings).
 * A pre-existing project listing with the same name (and verticalBaseMaps
 * flag) is reused instead of duplicated — pass it via existingListings.
 * A listing config flagged `fallback: true` only exists for projects without
 * any BASE_MAP listing yet: when the project already has some, it is neither
 * created nor matched (the scope works with the existing listings).
 */
export default function useCreateConfigurationBaseMaps() {
  const createListings = useCreateListings();
  const createBaseMaps = useCreateBaseMaps();
  const defaultBaseMapsListingProps = useDefaultBaseMapsListingProps();

  return async function createConfigurationBaseMaps({
    configuration,
    scope,
    projectId,
    existingListings,
  }) {
    const _existingListings = existingListings ?? [];

    // fallback listings drop out as soon as the project has a listing
    const listingConfigs = (configuration?.baseMaps?.listings ?? []).filter(
      (listingConfig) =>
        !listingConfig.fallback || _existingListings.length === 0
    );
    if (listingConfigs.length === 0) {
      return {
        // land on the project's first listing when nothing is declared
        firstListingId: _existingListings[0]?.id ?? null,
        firstBaseMapId: null,
        createdItemsCount: 0,
        reusedListingIds: [],
      };
    }

    // reuse project listings matched by name + orientation flag

    const resolved = listingConfigs.map((listingConfig) => ({
      listingConfig,
      existing:
        _existingListings.find(
          (l) =>
            l.name === listingConfig.name &&
            Boolean(l.verticalBaseMaps) ===
              Boolean(listingConfig.verticalBaseMaps)
        ) ?? null,
    }));

    // new listings — ranked in configuration order, appended after the last
    // existing listing (fractional-indexing keys sort lexicographically)

    let prevRank =
      _existingListings
        .map((l) => l.rank)
        .filter(Boolean)
        .sort()
        .pop() ?? null;

    const toCreate = resolved.filter((r) => !r.existing);
    const listingsToCreate = toCreate.map(({ listingConfig }) => {
      const rank = generateKeyBetween(prevRank, null);
      prevRank = rank;
      return {
        ...defaultBaseMapsListingProps,
        name: listingConfig.name,
        ...(listingConfig.verticalBaseMaps && { verticalBaseMaps: true }),
        rank,
        projectId,
        canCreateItem: true,
      };
    });

    const createdListings =
      toCreate.length > 0
        ? await createListings({ listings: listingsToCreate, scope })
        : [];

    let createdIndex = 0;
    const listingsByConfig = resolved.map(
      (r) => r.existing ?? createdListings[createdIndex++]
    );

    // baseMap items — per listing, in declaration order

    let createdItemsCount = 0;
    let firstBaseMapId = null;

    for (let i = 0; i < listingConfigs.length; i++) {
      const listingConfig = listingConfigs[i];
      const listing = listingsByConfig[i];
      if (!listing || !listingConfig.items?.length) continue;

      const baseMaps = [];

      for (const item of listingConfig.items) {
        if (item.type === "BLANK_PAGE") {
          const format =
            FORMAT_BY_PAGE_ORIENTATION[item.pageOrientation] ?? "paysage";
          const { pixelWidth, pixelHeight, meterByPx } =
            getBlankBaseMapGeometry({
              format,
              size: item.pageFormat ?? "A3",
              scale: item.scale ?? 50,
            });
          const imageFile = await createBlankImageFile({
            width: pixelWidth,
            height: pixelHeight,
            fileName: `${item.name ?? "page-blanche"}.png`,
          });
          baseMaps.push({ name: item.name, imageFile, meterByPx });
        } else if (item.type === "ASSET" && item.assetUrl) {
          try {
            const response = await fetch(item.assetUrl);
            const blob = await response.blob();
            const fileName = item.assetPath?.split("/").pop() ?? "asset.png";
            const imageFile = new File([blob], fileName, { type: blob.type });
            baseMaps.push({
              name: item.name,
              imageFile,
              meterByPx: item.meterByPx,
            });
          } catch (error) {
            console.error(
              "[createConfigurationBaseMaps] asset fetch failed",
              item.assetPath,
              error
            );
          }
        }
      }

      if (baseMaps.length > 0) {
        const records = await createBaseMaps(baseMaps, { listing });
        createdItemsCount += records?.length ?? 0;
        if (!firstBaseMapId) firstBaseMapId = records?.[0]?.id ?? null;
      }
    }

    return {
      firstListingId: listingsByConfig[0]?.id ?? null,
      firstBaseMapId,
      createdItemsCount,
      reusedListingIds: resolved
        .filter((r) => r.existing)
        .map((r) => r.existing.id),
    };
  };
}
