import { useSelector } from "react-redux";

import usePresetScopes from "./usePresetScopes";

export default function useSelectedPresetScope() {
  const presetScopes = usePresetScopes();
  const selectedPresetScopeKey = useSelector(
    (s) => s.scopeCreator.selectedPresetScopeKey
  );

  return presetScopes.find((s) => s.key === selectedPresetScopeKey);
}
