import useAppConfig from "Features/appConfig/hooks/useAppConfig";

// The image-transformation prompt used by the POV "Amélioration IA" option:
// the org's imageTransformationPrompts item flagged `usedByPov` (resolved
// from Data/<org> by resolveAppConfig — never imported statically). Also
// exposes the enhance endpoint url shared with the baseMap "Transformation
// IA" feature.
export default function usePovEnhancePrompt() {
  const appConfig = useAppConfig();

  const prompt =
    appConfig?.imageTransformationPrompts?.find((p) => p.usedByPov) ?? null;
  const serviceUrl =
    appConfig?.features?.enhanceBaseMap?.fetchParams?.url ?? null;

  return { prompt, serviceUrl, enabled: Boolean(prompt && serviceUrl) };
}
