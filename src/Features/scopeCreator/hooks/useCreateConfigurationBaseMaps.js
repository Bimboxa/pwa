import { useSelector } from "react-redux";
import { generateKeyBetween } from "fractional-indexing";
import { getDocument } from "pdfjs-dist";

import useCreateListings from "Features/listings/hooks/useCreateListings";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";
import useCreateBaseMaps from "Features/baseMapCreator/hooks/useCreateBaseMaps";

import ensurePdfPageResources from "Features/resources/services/ensurePdfPageResourcesService";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";

import createBlankImageFile from "Features/images/utils/createBlankImageFile";
import getBlankBaseMapGeometry, {
  getBlankBaseMapPrintZone,
} from "Features/baseMaps/utils/getBlankBaseMapGeometry";
// also sets the pdf.js worker (GlobalWorkerOptions) through pdfToPngAsync
import renderTempBaseMapImage from "Features/baseMapCreator/utils/renderTempBaseMapImage";
import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";

// configuration pageOrientation -> getBlankBaseMapGeometry format
const FORMAT_BY_PAGE_ORIENTATION = {
  LANDSCAPE: "paysage",
  PORTRAIT: "portrait",
  SQUARE: "carre",
};

// PDF_PAGE items: rasterization resolution when the item declares no `dpi`
// — the blank pages' 150 DPI, so an A3 sheet gives the same image size and
// meterByPx as a BLANK_PAGE of the same scale.
const DEFAULT_PDF_PAGE_DPI = 150;
const DEFAULT_PDF_PAGE_SCALE = 50;

/*
 * Create the baseMap listings (and their BLANK_PAGE / ASSET / PDF_PAGE
 * baseMap items) declared by a Krto creation configuration
 * (configuration.baseMaps.listings).
 * A pre-existing project listing with the same name (and verticalBaseMaps
 * flag) is reused instead of duplicated — pass it via existingListings.
 * A listing config flagged `fallback: true` only exists for projects without
 * any BASE_MAP listing yet: when the project already has some, it is neither
 * created nor matched (the scope works with the existing listings).
 * PDF_PAGE items follow the user PDF import: the page is rasterized
 * (renderTempBaseMapImage) and kept as a PDF_PAGE resource of the project
 * (ensurePdfPageResources) referenced by createdFrom, so the base map can be
 * regenerated from the PDF later. One PDF is fetched / opened once, whatever
 * the number of items pointing at it.
 */
export default function useCreateConfigurationBaseMaps() {
  const createListings = useCreateListings();
  const createBaseMaps = useCreateBaseMaps();
  const defaultBaseMapsListingProps = useDefaultBaseMapsListingProps();

  const userProfile = useSelector((s) => s.auth.userProfile);

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

    // PDF sources of the PDF_PAGE items — one fetch + pdf.js document +
    // page resources per PDF (an item may point at any page of it)

    const pageNumbersByPdfUrl = new Map();
    for (const listingConfig of listingConfigs) {
      for (const item of listingConfig.items ?? []) {
        if (item.type !== "PDF_PAGE" || !item.assetUrl) continue;
        if (!pageNumbersByPdfUrl.has(item.assetUrl)) {
          pageNumbersByPdfUrl.set(item.assetUrl, new Set());
        }
        pageNumbersByPdfUrl.get(item.assetUrl).add(Number(item.pageNumber));
      }
    }

    const debugAuth = getDebugAuthFromLocalStorage();
    const createdBy = {
      idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
      trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
    };

    // assetUrl -> Promise<{ pdfFile, pdfDocument, pageResources } | null>
    const pdfSources = new Map();
    function getPdfSource(assetUrl, assetPath) {
      if (!pdfSources.has(assetUrl)) {
        pdfSources.set(
          assetUrl,
          (async () => {
            const response = await fetch(assetUrl);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const blob = await response.blob();
            const fileName = assetPath?.split("/").pop() ?? "document.pdf";
            const pdfFile = new File([blob], fileName, {
              type: "application/pdf",
            });
            const pdfDocument = await getDocument({
              data: await pdfFile.arrayBuffer(),
              ...PDFJS_DOC_PARAMS,
            }).promise;
            const failures = [];
            const pageResources = await ensurePdfPageResources({
              pdfFile,
              pdfDocument,
              pageNumbers: [...(pageNumbersByPdfUrl.get(assetUrl) ?? [])],
              projectId,
              createdBy,
              failures,
            });
            if (failures.length > 0) {
              console.warn(
                "[createConfigurationBaseMaps] PDF source not kept, the base maps will not be regenerable from the PDF",
                assetPath,
                failures
              );
            }
            return { pdfFile, pdfDocument, pageResources };
          })().catch((error) => {
            console.error(
              "[createConfigurationBaseMaps] PDF asset load failed",
              assetPath,
              error
            );
            return null;
          })
        );
      }
      return pdfSources.get(assetUrl);
    }

    // baseMap items — per listing, in declaration order

    let createdItemsCount = 0;
    let firstBaseMapId = null;

    try {
      for (let i = 0; i < listingConfigs.length; i++) {
        const listingConfig = listingConfigs[i];
        const listing = listingsByConfig[i];
        if (!listing || !listingConfig.items?.length) continue;

        const baseMaps = [];

        for (const item of listingConfig.items) {
          if (item.type === "PDF_PAGE" && item.assetUrl) {
            const source = await getPdfSource(item.assetUrl, item.assetPath);
            if (!source) continue;
            const { pdfFile, pdfDocument, pageResources } = source;
            const pageNumber = Number(item.pageNumber) || 1;
            if (pageNumber > pdfDocument.numPages) {
              console.error(
                `[createConfigurationBaseMaps] page ${pageNumber} missing in ${item.assetPath} (${pdfDocument.numPages} page(s))`
              );
              continue;
            }
            try {
              const pdfPage = await pdfDocument.getPage(pageNumber);
              // absolute rotation: the page's own /Rotate
              const rotate = pdfPage.rotate ?? 0;
              const blueprintScale = item.scale ?? DEFAULT_PDF_PAGE_SCALE;
              const { imageFile, meterByPx, dpi } =
                await renderTempBaseMapImage({
                  pdfFile,
                  pdfDocument,
                  page: pageNumber,
                  rotate,
                  blueprintScale,
                  resolution: item.dpi ?? DEFAULT_PDF_PAGE_DPI,
                });
              const resource = pageResources.get(pageNumber) ?? null;
              baseMaps.push({
                name: item.name,
                imageFile,
                meterByPx,
                // same provenance as ButtonCreateBaseMaps: pageNumber is the
                // page IN the (single-page) resource, sourcePageNumber the
                // page in the configuration PDF. The print zone is resolved
                // at read time from dpi + blueprintScale (resolvePrintZone).
                createdFrom: {
                  type: "PDF_PAGE",
                  pdfFileName: resource?.name ?? pdfFile.name ?? null,
                  resourceId: resource?.id ?? null,
                  pageNumber: resource
                    ? (resource.pageInResource ?? 1)
                    : pageNumber,
                  sourcePageNumber: pageNumber,
                  rotation: rotate,
                  bboxInRatio: null,
                  dpi: dpi ?? null,
                  blueprintScale: blueprintScale || null,
                },
              });
            } catch (error) {
              console.error(
                "[createConfigurationBaseMaps] PDF page render failed",
                item.assetPath,
                pageNumber,
                error
              );
            }
          } else if (item.type === "BLANK_PAGE") {
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
            baseMaps.push({
              name: item.name,
              imageFile,
              meterByPx,
              printZone: getBlankBaseMapPrintZone({
                format,
                size: item.pageFormat ?? "A3",
                scale: item.scale ?? 50,
                pixelWidth,
                pixelHeight,
              }),
            });
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
    } finally {
      for (const sourcePromise of pdfSources.values()) {
        const source = await sourcePromise;
        source?.pdfDocument?.destroy();
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
