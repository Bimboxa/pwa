import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useEntityModels(options) {
  const projectId = options?.projectId;

  const appConfig = useAppConfig();

  const dbModels = useLiveQuery(async () => {
    if (!projectId) return [];
    return (
      await db.entityModels.where("projectId").equals(projectId).toArray()
    ).filter((r) => !r.deletedAt);
  }, [projectId]);

  if (!appConfig || !dbModels) return undefined;

  // YAML models (readonly, always first)
  const entityModelsObject = appConfig?.entityModelsObject ?? {};
  const yamlModels = Object.values(entityModelsObject).map((model) => ({
    ...model,
    readonly: true,
  }));

  // DB models (editable)
  const editableModels = dbModels.map((model) => ({
    ...model,
    readonly: false,
  }));

  return [...yamlModels, ...editableModels];
}
