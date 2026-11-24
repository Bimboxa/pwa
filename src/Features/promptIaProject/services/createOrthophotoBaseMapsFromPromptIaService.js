import db from "App/db/db";

import { addOrthophotosService } from "Features/orthophotos/services/orthophotoServices";

const errorMessage = (e) => e?.message ?? String(e);

/**
 * Orthomosaic base maps of a Prompt IA result (`baseMaps[].orthophoto`, see
 * parsePromptIaProjectOutput): the mosaic image of the zip becomes a regular
 * image base map flagged `isOrthophoto`, its unit orthophotos become
 * db.orthophotos rows (one transaction per base map).
 *
 * @param {Object} params
 * @param {Object[]} params.baseMaps - parsed base maps carrying `orthophoto`
 * @param {Map<string, File>} params.orthophotoFilesByPath
 * @param {Function} params.createBaseMaps - useCreateBaseMaps()
 * @param {(baseMap: Object) => Object|null} params.getListing
 * @param {(step: string) => void} [params.tick]
 * @param {string[]} params.errors - messages for the user
 * @returns {Promise<{created: Map<string, {record: Object, frame: null, page: null}>, orthophotosCount: number}>}
 *   `created`: parsed base map id → record (no PDF frame: the annotations of
 *   an orthomosaic are always normalized on its image).
 */
export default async function createOrthophotoBaseMapsFromPromptIaService({
  baseMaps,
  orthophotoFilesByPath,
  createBaseMaps,
  getListing,
  tick = () => {},
  errors,
}) {
  const created = new Map();
  let orthophotosCount = 0;

  for (const baseMap of baseMaps) {
    tick(`Fond de plan « ${baseMap.name} »`);
    const { file, meterByPx, photos } = baseMap.orthophoto;
    try {
      const imageFile = orthophotoFilesByPath?.get(file);
      if (!imageFile) throw new Error("image absente du zip");
      const listing = getListing(baseMap);
      if (!listing) throw new Error("aucune liste de fonds de plan");

      let [record] = await createBaseMaps(
        [{ name: baseMap.name, imageFile, meterByPx: meterByPx ?? undefined }],
        { listing }
      );
      if (!record) throw new Error("fond de plan non créé");
      await db.baseMaps.update(record.id, { isOrthophoto: true });
      record = { ...record, isOrthophoto: true };
      created.set(baseMap.id, { record, frame: null, page: null });

      try {
        const rows = await addOrthophotosService({
          baseMap: {
            id: record.id,
            projectId: record.projectId ?? listing.projectId,
            listingId: record.listingId ?? listing.id,
          },
          items: photos
            .map((photo) => ({
              name: photo.name,
              orthoFile: orthophotoFilesByPath.get(photo.orthoFile),
              sourceFile: photo.sourceFile
                ? orthophotoFilesByPath.get(photo.sourceFile)
                : null,
              station: photo.station,
              corners: photo.corners,
            }))
            .filter((item) => item.orthoFile),
        });
        orthophotosCount += rows.length;
      } catch (e) {
        errors.push(
          `Orthophotos de « ${baseMap.name} » non importées : ${errorMessage(e)}`
        );
      }
    } catch (e) {
      errors.push(
        `Fond de plan « ${baseMap.name} » non créé : ${errorMessage(e)}`
      );
    }
  }

  return { created, orthophotosCount };
}
