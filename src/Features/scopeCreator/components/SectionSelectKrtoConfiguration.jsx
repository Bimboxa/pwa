import { Box } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useKrtoConfigurations from "../hooks/useKrtoConfigurations";

import CardKrtoConfiguration from "./CardKrtoConfiguration";

/*
 * Card grid of the configuration selector, filtered by the left nav
 * (activeFilter = {family, keyword}) and the header search text.
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
  const genericChipS = "Vide";
  const prerequisiteS =
    appConfig?.strings?.scope?.sourcePrerequisite ?? "Pré-requis";

  // helpers

  const items = krtoConfigurations?.items ?? [];

  // name of the configurations a source-fed configuration needs
  // (sourceConfigurationKeys), shown as « Pré-requis » chips on its card
  const nameByKey = Object.fromEntries(items.map((i) => [i.key, i.name]));
  function getPrerequisiteNames(item) {
    return (item.sourceConfigurationKeys ?? [])
      .map((key) => nameByKey[key])
      .filter(Boolean);
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
    !activeFilter?.type &&
    !activeFilter?.ouvrage &&
    matchesSearch([genericLabelS, genericHelperS]);

  // render

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
        gap: 2.5,
        alignContent: "start",
      }}
    >
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
      {filteredItems.map((item) => (
        <CardKrtoConfiguration
          key={item.key}
          name={item.name}
          description={item.description}
          imageUrl={item.imageUrl}
          code={item.code}
          chipLabel={item.chipLabel}
          prerequisiteLabel={prerequisiteS}
          prerequisiteNames={getPrerequisiteNames(item)}
          selected={selectedKey === item.key}
          onClick={() => onSelect(item.key)}
        />
      ))}
    </Box>
  );
}
