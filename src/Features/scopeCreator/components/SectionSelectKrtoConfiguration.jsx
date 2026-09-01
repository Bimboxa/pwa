import { useState } from "react";

import { Box } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useKrtoConfigurations from "../hooks/useKrtoConfigurations";

import CardKrtoConfiguration from "./CardKrtoConfiguration";
import ChipsFilterKrtoConfigurationKeywords from "./ChipsFilterKrtoConfigurationKeywords";

export default function SectionSelectKrtoConfiguration({
  selectedKey,
  onSelect,
}) {
  // data

  const appConfig = useAppConfig();
  const krtoConfigurations = useKrtoConfigurations();

  // strings

  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Dossier";
  const genericLabelS = `${scopeS} générique`;
  const genericHelperS = "Structure vide, à construire librement";

  // state

  const [selectedKeywordsByFamily, setSelectedKeywordsByFamily] = useState({});

  // helpers — AND across families, OR within a family; a configuration
  // without keywords in a filtered family matches everything.

  const items = krtoConfigurations?.items ?? [];
  const keywordFamilies = krtoConfigurations?.keywordFamilies ?? [];

  const filteredItems = items.filter((item) =>
    keywordFamilies.every((family) => {
      const selectedKeywords = selectedKeywordsByFamily[family.key] ?? [];
      if (selectedKeywords.length === 0) return true;
      const itemKeywords = item.keywords?.[family.key] ?? [];
      if (itemKeywords.length === 0) return true;
      return selectedKeywords.some((keyword) =>
        itemKeywords.includes(keyword)
      );
    })
  );

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <ChipsFilterKrtoConfigurationKeywords
        keywordFamilies={keywordFamilies}
        items={items}
        selectedKeywordsByFamily={selectedKeywordsByFamily}
        onChange={setSelectedKeywordsByFamily}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 1.5,
        }}
      >
        <CardKrtoConfiguration
          name={genericLabelS}
          description={genericHelperS}
          selected={selectedKey == null}
          onClick={() => onSelect(null)}
        />
        {filteredItems.map((item) => (
          <CardKrtoConfiguration
            key={item.key}
            name={item.name}
            description={item.description}
            imageUrl={item.imageUrl}
            selected={selectedKey === item.key}
            onClick={() => onSelect(item.key)}
          />
        ))}
      </Box>
    </Box>
  );
}
