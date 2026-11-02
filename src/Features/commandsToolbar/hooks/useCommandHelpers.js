import { useMemo } from "react";
import { useSelector } from "react-redux";

const EMPTY_BY_KEY = {};

// Per-org helpers of the toolbar commands, resolved by resolveAppConfig from
// Data/<org>/commands/<COMMAND_KEY>.md into
// appConfig.features.commandHelpers = { basePath, byKey }:
//   byKey[key] = { description: Markdown | null, gif: relative path | null }
// Returns { orgaCode, basePath, byKey } — byKey is a stable empty object when
// the org provides no helper.
export default function useCommandHelpers() {
  const orgaCode = useSelector((s) => s.appConfig.value?.orgaCode ?? null);
  const helpers = useSelector(
    (s) => s.appConfig.value?.features?.commandHelpers ?? null
  );

  return useMemo(
    () => ({
      orgaCode,
      basePath: helpers?.basePath ?? "commands",
      byKey: helpers?.byKey ?? EMPTY_BY_KEY,
    }),
    [orgaCode, helpers]
  );
}
