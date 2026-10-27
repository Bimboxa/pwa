import createLocalScanRuntime from "./createLocalScanRuntime";
import readLocalScanInWorker from "./readLocalScanInWorker";
import { getAvailableScanSource } from "./scanResources";

const MISSING_SOURCE =
  "Le fichier de ce scan est absent de cet appareil. Rechargez-le depuis Ressources.";

const localScanRuntime = createLocalScanRuntime(
  async (resource, { signal, onProgress }) => {
    const source = await getAvailableScanSource(resource);
    if (!source) throw new Error(MISSING_SOURCE);
    const data = await readLocalScanInWorker(source, {
      signal,
      onProgress,
      read: { zone: resource.scan?.zone },
    });
    return { data, source };
  }
);

export default localScanRuntime;
