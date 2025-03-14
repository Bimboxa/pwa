import appConfigAsync from "../appConfigAsync";

export default async function getEntityModelAsync(key) {
  const appConfig = await appConfigAsync;

  const entityModelsObject = appConfig.entityModelsObject;

  return entityModelsObject[key];
}
