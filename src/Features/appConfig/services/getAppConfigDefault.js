import appConfigRaw from "../data/appConfigDefault.yaml?raw";
import yaml from "js-yaml";

export default async function getAppConfigDefault() {
  const appConfig = yaml.load(appConfigRaw);
  return appConfig;
}
