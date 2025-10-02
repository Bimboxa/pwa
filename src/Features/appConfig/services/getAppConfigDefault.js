import appConfigRawDefault from "../data/appConfig_default.yaml?raw";

import yaml from "js-yaml";

export default async function getAppConfigDefault({ configCode }) {
  let appConfigRaw = appConfigRawDefault;

  if (configCode) {
    try {
      let url = `../data/appConfig_${configCode}.yaml`;
      const { default: appConfigRawXxx } = await import(url);
      appConfigRaw = appConfigRawXxx;
    } catch (error) {
      console.warn("appConfig_xxx.yaml not found, using default config");
      // Keep using appConfigRawDefault
    }
  }

  const appConfig = yaml.load(appConfigRaw);
  return appConfig;
}
