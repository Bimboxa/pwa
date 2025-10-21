import fetchMediaServiceV2 from "Features/sync/services/fetchMediaServiceV2";
import krtoZipToKrtoFile from "Features/krtoFile/services/krtoZipToKrtoFile";
import loadKrtoFile from "Features/krtoFile/services/loadKrtoFile";

export default async function downloadAndLoadKrtoVersionService({
  id,
  onProgress,
}) {
  const blob = await fetchMediaServiceV2({ id, onProgress });
  const krtoFile = await krtoZipToKrtoFile(blob);
  const project = await loadKrtoFile(krtoFile);
  return project;
}
