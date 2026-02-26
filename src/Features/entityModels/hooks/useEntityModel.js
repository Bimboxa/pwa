import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useEntityModel(key) {
  const appConfig = useAppConfig();

  const dbModel = useLiveQuery(async () => {
    if (!key) return null;
    const results = await db.entityModels.where("key").equals(key).toArray();
    const active = results.filter((r) => !r.deletedAt);
    return active[0] ?? null;
  }, [key]);

  if (!key) return null;

  // DB first
  if (dbModel) return { ...dbModel, readonly: false };

  // YAML fallback
  const yamlModel = appConfig?.entityModelsObject?.[key];
  if (yamlModel) return { ...yamlModel, readonly: true };

  return null;
}
