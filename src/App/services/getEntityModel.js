import appConfigAsync from "../appConfigAsync";

export default async function getEntityModelAsync(key) {
  const appConfig = await appConfigAsync;

  if (!appConfig) {
    throw new Error("appConfig is not defined");
  }

  const entityModelsObject = appConfig.entityModelsObject;

  return entityModelsObject?.[key];
}
