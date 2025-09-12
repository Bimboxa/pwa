import appConfigRawDefault from "../data/appConfig_default.yaml?raw";

import appConfigRawLei from "../data/appConfig_lei.yaml?raw";
import appConfigRawEdx from "../data/appConfig_edx.yaml?raw";
import yaml from "js-yaml";

export default async function getAppConfigDefault({ configCode }) {
  let appConfigRaw = appConfigRawDefault;
  if (configCode === "lei") appConfigRaw = appConfigRawLei;
  if (configCode === "edx") appConfigRaw = appConfigRawEdx;

  const appConfig = yaml.load(appConfigRaw);
  return appConfig;
}
