import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

// The image-transformation prompt used by the POV "Amélioration IA" option:
// the org's imageTransformationPrompts item flagged `usedByPov` (resolved
// from Data/<org> by resolveAppConfig — never imported statically). Also
// exposes the enhance endpoint url shared with the baseMap "Transformation
// IA" feature.
//
// `promptText` is what is actually sent to the endpoint: the user's edit
// (persisted in localStorage, see povEnhancePromptLocalStorage) when there
// is one, the org's default otherwise. `isCustom` tells the UI to flag it.
export default function usePovEnhancePrompt() {
  const appConfig = useAppConfig();

  const promptById = useSelector((s) => s.pov.aiEnhancePromptById);

  const prompt =
    appConfig?.imageTransformationPrompts?.find((p) => p.usedByPov) ?? null;
  const serviceUrl =
    appConfig?.features?.enhanceBaseMap?.fetchParams?.url ?? null;

  const customPrompt = prompt ? promptById?.[prompt.id] : null;
  const defaultPromptText = prompt?.prompt ?? "";

  return {
    prompt,
    promptText: customPrompt || defaultPromptText,
    defaultPromptText,
    isCustom: Boolean(customPrompt),
    serviceUrl,
    enabled: Boolean(prompt && serviceUrl),
  };
}
