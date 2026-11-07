import yaml from "js-yaml";

const CONFIG_LOADERS = import.meta.glob("../data/appConfig_*.yaml", {
  query: "?raw",
  import: "default",
  eager: false,
});

export default async function getAppConfigDefault({ configCode } = {}) {
  const requestedCode = configCode?.trim().toLowerCase();
  const code =
    !requestedCode || requestedCode === "default" ? "public" : requestedCode;
  const wantedKey = `../data/appConfig_${code}.yaml`;

  let loader = CONFIG_LOADERS[wantedKey];

  if (!loader) {
    console.warn(`appConfig_${code}.yaml not found, using public config`);
    loader = CONFIG_LOADERS["../data/appConfig_public.yaml"];
  }
  if (!loader) {
    throw new Error(
      'No public config found. Expected "../data/appConfig_public.yaml" to be bundled.'
    );
  }

  return yaml.load(await loader());
}
