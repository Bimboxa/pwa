import _appConfigRaw from "../data/_appConfig.yaml?raw";
import yaml from "js-yaml";

export default async function getAppConfigDefault() {
  const appConfig = yaml.load(_appConfigRaw);
  return appConfig;
}
