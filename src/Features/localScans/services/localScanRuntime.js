import db from "App/db/db";
import createLocalScanRuntime from "./createLocalScanRuntime";
import createScanResourceStore from "./createScanResourceStore";
import readLocalScanInWorker from "./readLocalScanInWorker";

const MISSING_SOURCE =
  "Le fichier de ce scan est absent de cet appareil. Rechargez-le depuis Ressources.";

// Only saved project resources go through the runtime (never the legacy
// per-scope store), so the 3D editor imports no legacy scan database.
const resources = createScanResourceStore(db, () => {
  throw new Error("The scan runtime never creates resources.");
});

const localScanRuntime = createLocalScanRuntime(
  async (resource, { signal, onProgress }) => {
    const source = await resources.source(resource);
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
