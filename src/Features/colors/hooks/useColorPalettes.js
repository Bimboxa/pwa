import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { STABILOS, SPECTRE, NEUTRES } from "../constants/colorPalettes";

// Ordered colour sections for the fill / stroke / colour pickers.
// The first (brand) section is org-configured — its label and colours come from
// appConfig (`features.colors.brandPalette`), so no brand name is hard-coded in
// the app. The other sections are generic, app-level palettes.
export default function useColorPalettes() {
  const appConfig = useAppConfig();
  const brandPalette = appConfig?.features?.colors?.brandPalette;

  const sections = [];

  if (Array.isArray(brandPalette?.colors) && brandPalette.colors.length > 0) {
    sections.push({
      key: "brand",
      label: brandPalette.label ?? "Charte",
      colors: brandPalette.colors,
    });
  }

  sections.push({ key: "stabilos", label: "Stabilos", colors: STABILOS });
  sections.push({ key: "spectre", label: "Spectre", colors: SPECTRE });
  sections.push({ key: "neutres", label: "Neutres", colors: NEUTRES });

  return sections;
}
