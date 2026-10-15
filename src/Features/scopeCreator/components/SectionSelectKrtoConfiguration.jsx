import { Box } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useKrtoConfigurations from "../hooks/useKrtoConfigurations";

import CardKrtoConfiguration from "./CardKrtoConfiguration";

import { EMPTY_SCOPE_USAGE_KEYWORD } from "../data/emptyScopeConfiguration";

/*
 * Card grid of the configuration selector, filtered by the left nav
 * (activeFilter = {family, keyword}) and the header search text. The built-in
 * "vide" card belongs to the EMPTY_SCOPE_USAGE_KEYWORD usage.
 */
export default function SectionSelectKrtoConfiguration({
  selectedKey,
  onSelect,
  searchText,
  activeFilter,
}) {
  // data

  const appConfig = useAppConfig();
  const krtoConfigurations = useKrtoConfigurations();

  // strings

  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Dossier";
  const genericLabelS = appConfig?.strings?.scope?.newEmpty ?? `${scopeS} vide`;
  const genericHelperS = "Structure vide, à construire librement.";
  const genericCodeS = "VIDE";
  const genericChipS = EMPTY_SCOPE_USAGE_KEYWORD;
  const prerequisiteS =
    appConfig?.strings?.scope?.sourcePrerequisite ?? "Pré-requis";

  // helpers

  const items = krtoConfigurations?.items ?? [];

  // name of the configuration a configuration requires first
  // (prerequisiteConfigurationKey), shown as a warning line on its card
  const nameByKey = Object.fromEntries(items.map((i) => [i.key, i.name]));
  function getPrerequisiteName(item) {
    const key = item.prerequisiteConfigurationKey;
    return key ? (nameByKey[key] ?? null) : null;
  }

  const search = searchText?.trim().toLowerCase() ?? "";

  function matchesSearch(texts) {
    if (!search) return true;
    return texts.some((t) => t?.toLowerCase().includes(search));
  }

  // combined filters: one keyword per family (AND across families)
  const filteredItems = items.filter((item) => {
    for (const familyKey of ["type", "ouvrage"]) {
      const keyword = activeFilter?.[familyKey];
      if (!keyword) continue;
      const itemKeywords = item.keywords?.[familyKey] ?? [];
      if (!itemKeywords.includes(keyword)) return false;
    }
    return matchesSearch([
      item.name,
      item.description,
      item.code,
      ...Object.values(item.keywords ?? {}).flat(),
    ]);
  });

  const showGeneric =
    (!activeFilter?.type || activeFilter.type === EMPTY_SCOPE_USAGE_KEYWORD) &&
    !activeFilter?.ouvrage &&
    matchesSearch([genericLabelS, genericHelperS, EMPTY_SCOPE_USAGE_KEYWORD]);

  // the "vide" card opens the group of its usage keyword (end of the grid
  // when no card of that group is visible)
  const genericIndex = filteredItems.findIndex((item) =>
    (item.keywords?.type ?? []).includes(EMPTY_SCOPE_USAGE_KEYWORD)
  );
  const genericPosition =
    genericIndex === -1 ? filteredItems.length : genericIndex;

  // render

  function renderItem(item) {
    return (
      <CardKrtoConfiguration
        key={item.key}
        name={item.name}
        description={item.description}
        imageUrl={item.imageUrl}
        code={item.code}
        chipLabel={item.chipLabel}
        prerequisiteLabel={prerequisiteS}
        prerequisiteName={getPrerequisiteName(item)}
        selected={selectedKey === item.key}
        onClick={() => onSelect(item.key)}
      />
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
        gap: 2.5,
        alignContent: "start",
      }}
    >
      {filteredItems.slice(0, genericPosition).map(renderItem)}
      {showGeneric && (
        <CardKrtoConfiguration
          name={genericLabelS}
          description={genericHelperS}
          code={genericCodeS}
          chipLabel={genericChipS}
          selected={selectedKey == null}
          onClick={() => onSelect(null)}
        />
      )}
      {filteredItems.slice(genericPosition).map(renderItem)}
    </Box>
  );
}
