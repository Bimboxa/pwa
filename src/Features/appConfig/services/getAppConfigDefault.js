import yaml from "js-yaml";

// NOTE: The glob path must be *relative to this file*.
// Adjust "../data/..." if your file lives elsewhere.
const CONFIG_LOADERS = import.meta.glob("../data/appConfig_*.yaml", {
  as: "raw", // return file contents as string
  eager: false, // keep it lazy; call the function to load
});

export default async function getAppConfigDefault({ configCode }) {
  const code = configCode.toLowerCase();
  const wantedKey = `../data/appConfig_${code}.yaml`;

  let loader = CONFIG_LOADERS[wantedKey];

  if (!loader) {
    console.warn(`appConfig_${code}.yaml not found, using default config`);
    loader = CONFIG_LOADERS["../data/appConfig_default.yaml"];
  }
  if (!loader) {
    throw new Error(
      'No default config found. Expected "../data/appConfig_default.yaml" to be bundled.'
    );
  }

  const raw = await loader(); // string (because as:'raw')
  const appConfig = yaml.load(raw);
  return appConfig;
}
