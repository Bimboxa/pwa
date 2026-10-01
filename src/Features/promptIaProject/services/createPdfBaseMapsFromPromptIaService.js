import { getDocument } from "pdfjs-dist";

import ensurePdfPageResources from "Features/resources/services/ensurePdfPageResourcesService";

import renderTempBaseMapImage from "Features/baseMapCreator/utils/renderTempBaseMapImage";
import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";

const errorMessage = (e) => e?.message ?? String(e);

function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

/**
 * Base maps of a Prompt IA result, rendered from the PDFs of the returned
 * zip: one base map per `{ source: { file, pageNumber, rotation,
 * bboxInRatio } }`, the PDF kept as page resources so the base map can be
 * regenerated later.
 *
 * Shared by the project creation (dashboard) and the chat Prompt IA. The
 * caller sets the pdf.js worker (GlobalWorkerOptions).
 *
 * @param {Object} params
 * @param {Object[]} params.baseMaps - parsed base maps: `id`, `name`,
 *   `source`, `blueprintScale`
 * @param {Map<string, File>} params.pdfFilesByPath
 * @param {string} params.projectId
 * @param {Function} params.createBaseMaps - useCreateBaseMaps()
 * @param {{idMaster, trigram}} params.createdBy
 * @param {(baseMap: Object) => Object|null} params.getListing - target base
 *   maps listing; null stops the batch
 * @param {(baseMap: Object, page: {view: number[], rotate: number}) => number|null} [params.getBlueprintScale]
 *   scale of the page (100 for 1/100) when it does not come from
 *   `baseMap.blueprintScale`; may throw to reject the base map
 * @param {(step: string) => void} [params.tick]
 * @param {string[]} params.errors - messages for the user
 * @returns {Promise<Map<string, {record: Object, frame: Object, page: Object}>>}
 *   parsed base map id → record + the geometry the pdf_user_space conversion
 *   needs
 */
export default async function createPdfBaseMapsFromPromptIaService({
  baseMaps,
  pdfFilesByPath,
  projectId,
  createBaseMaps,
  createdBy,
  getListing,
  getBlueprintScale = null,
  tick = () => {},
  errors,
}) {
  const created = new Map();

  const prepared = [];
  for (const [path, pathBaseMaps] of groupBy(baseMaps, (b) => b.source.file)) {
    const pdfFile = pdfFilesByPath.get(path);
    let pdfDocument = null;
    try {
      pdfDocument = await getDocument({
        data: await pdfFile.arrayBuffer(),
        ...PDFJS_DOC_PARAMS,
      }).promise;
    } catch (e) {
      errors.push(`PDF « ${path} » illisible : ${errorMessage(e)}`);
      pathBaseMaps.forEach((b) => tick(`Fond de plan « ${b.name} » ignoré`));
      continue;
    }

    try {
      const rendered = [];
      for (const baseMap of pathBaseMaps) {
        tick(`Fond de plan « ${baseMap.name} »`);
        const { pageNumber, bboxInRatio } = baseMap.source;
        try {
          if (pageNumber > pdfDocument.numPages)
            throw new Error(
              `page ${pageNumber} absente (${pdfDocument.numPages} page(s))`
            );
          const pdfPage = await pdfDocument.getPage(pageNumber);
          // absolute rotation: the page's own /Rotate unless overridden
          const rotate = baseMap.source.rotation ?? pdfPage.rotate ?? 0;
          const page = { view: pdfPage.view.map(Number) };
          const blueprintScale = getBlueprintScale
            ? getBlueprintScale(baseMap, { ...page, rotate })
            : baseMap.blueprintScale;
          const { imageFile, meterByPx, dpi } = await renderTempBaseMapImage({
            pdfFile,
            pdfDocument,
            page: pageNumber,
            bboxInRatio,
            rotate,
            blueprintScale,
            resolution: null, // AUTO
          });
          rendered.push({
            baseMap,
            imageFile,
            meterByPx,
            dpi,
            rotate,
            page,
            blueprintScale,
          });
        } catch (e) {
          errors.push(
            `Fond de plan « ${baseMap.name} » non créé : ${errorMessage(e)}`
          );
        }
      }

      const failures = [];
      const pageResources = await ensurePdfPageResources({
        pdfFile,
        pdfDocument,
        pageNumbers: rendered.map((r) => r.baseMap.source.pageNumber),
        projectId,
        createdBy,
        failures,
      });
      if (failures.length > 0)
        errors.push(
          `PDF « ${path} » non conservé : la régénération depuis le PDF ne sera pas disponible.`
        );

      for (const item of rendered) {
        const { pageNumber, bboxInRatio } = item.baseMap.source;
        const resource = pageResources.get(pageNumber) ?? null;
        prepared.push({
          ...item,
          createdFrom: {
            type: "PDF_PAGE",
            pdfFileName: resource?.name ?? pdfFile.name ?? null,
            resourceId: resource?.id ?? null,
            pageNumber: resource ? (resource.pageInResource ?? 1) : pageNumber,
            sourcePageNumber: pageNumber,
            rotation: item.rotate,
            bboxInRatio: bboxInRatio ?? null,
            dpi: item.dpi ?? null,
            blueprintScale: item.blueprintScale || null,
          },
        });
      }
    } finally {
      pdfDocument.destroy();
    }
  }

  // One call per base map, in the order of the json: a record always maps
  // to its payload entry, even when a neighbour fails.
  for (const item of prepared) {
    const listing = getListing(item.baseMap);
    if (!listing) {
      errors.push("Aucune liste de fonds de plan dans le projet.");
      break;
    }
    const [record] = await createBaseMaps(
      [
        {
          name: item.baseMap.name,
          imageFile: item.imageFile,
          meterByPx: item.meterByPx,
          createdFrom: item.createdFrom,
        },
      ],
      { listing }
    );
    if (!record) {
      errors.push(`Fond de plan « ${item.baseMap.name} » non créé.`);
      continue;
    }
    created.set(item.baseMap.id, {
      record,
      frame: {
        rotation: item.rotate,
        bboxInRatio: item.baseMap.source.bboxInRatio,
      },
      page: item.page,
    });
  }
  return created;
}
