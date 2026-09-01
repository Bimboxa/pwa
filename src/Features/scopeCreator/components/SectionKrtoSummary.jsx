import {
  Box,
  Button,
  CircularProgress,
  Tooltip,
  Typography,
} from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useKrtoConfigurations from "../hooks/useKrtoConfigurations";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import ChipsFilterKrtoConfigurationKeywords from "./ChipsFilterKrtoConfigurationKeywords";

// keyword families editable as scope categories — one selection per family;
// "principal" in the labels lifts the ambiguity when a configuration carries
// several keywords.
const CATEGORY_FAMILIES = [
  { key: "ouvrage", label: "Ouvrage principal" },
  { key: "type", label: "Type principal" },
];

const ORIENTATION_LABELS = {
  LANDSCAPE: "paysage",
  PORTRAIT: "portrait",
  SQUARE: "carré",
};

function getBaseMapItemLabel(item) {
  if (item.type === "BLANK_PAGE") {
    const orientation = ORIENTATION_LABELS[item.pageOrientation] ?? "paysage";
    const format = item.pageFormat ?? "A3";
    const scale = item.scale ? ` · 1/${item.scale}` : "";
    return `${item.name} — ${format} ${orientation}${scale}`;
  }
  return item.name;
}

/*
 * Summary of the Krto about to be created — name on top, then the baseMap
 * listings, the annotation template libraries (with their templates) and the
 * ouvrage/type categories (saved into scope.metaData), each in a white
 * section. The create button (hotkey C) sits at the bottom right.
 */
export default function SectionKrtoSummary({
  nameField,
  configuration,
  projectId,
  categories,
  onCategoriesChange,
  onCreate,
  isCreating,
  canCreate,
}) {
  // strings

  const titleS = "Récapitulatif";
  const baseMapsS = "Dossiers de plans";
  const librariesS = "Modèles d'annotations";
  const categoriesS = "Catégories";
  const noBaseMapsS = "Aucun nouveau dossier de plans";
  const noLibrariesS = "Aucune bibliothèque de modèles";
  const existingS = "existant";
  const disableExistingS = "Les dossiers de plans existants seront masqués.";
  const createS = "Créer";
  const hotkeyTooltipS = "Appuyez sur C pour créer";
  const noProjectS =
    "Sélectionnez d'abord un projet dans le tableau de bord.";

  // data

  const appConfig = useAppConfig();
  const krtoConfigurations = useKrtoConfigurations();
  const existingBaseMapListings = useProjectBaseMapListings({ projectId });

  // helpers — baseMap listings that will be created (or reused)

  let baseMapRows = [];
  if (configuration?.baseMaps?.listings?.length) {
    baseMapRows = configuration.baseMaps.listings.map((listing) => ({
      name: listing.name,
      existing: Boolean(
        existingBaseMapListings?.find(
          (l) =>
            l.name === listing.name &&
            Boolean(l.verticalBaseMaps) === Boolean(listing.verticalBaseMaps)
        )
      ),
      items: listing.items ?? [],
    }));
  } else if (!existingBaseMapListings?.length) {
    // generic scope on a project without baseMaps: the two default listings
    baseMapRows = [
      { name: "Vues en plan", existing: false, items: [] },
      { name: "Coupes & élévations", existing: false, items: [] },
    ];
  }

  const showDisableExisting =
    configuration?.baseMaps?.disableExistingListings &&
    existingBaseMapListings?.some(
      (l) => !baseMapRows.find((row) => row.existing && row.name === l.name)
    );

  // helpers — annotation template libraries (= preset listings) + templates

  const libraries = (configuration?.annotations?.libraryKeys ?? []).map(
    (key) => {
      const presetListing = appConfig?.presetListingsObject?.[key];
      return {
        key,
        name: presetListing?.name ?? key,
        templates: presetListing?.annotationTemplatesLibrary ?? [],
      };
    }
  );

  // render

  return (
    <Box
      sx={{
        width: 420,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        p: 2,
        m: 2,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        bgcolor: "background.default",
        overflow: "auto",
      }}
    >
      <Typography variant="overline" sx={{ color: "text.secondary" }}>
        {titleS}
      </Typography>

      <WhiteSectionGeneric>{nameField}</WhiteSectionGeneric>

      <WhiteSectionGeneric>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          {categoriesS}
        </Typography>
        <ChipsFilterKrtoConfigurationKeywords
          keywordFamilies={CATEGORY_FAMILIES}
          items={krtoConfigurations?.items}
          selectedKeywordsByFamily={categories}
          onChange={onCategoriesChange}
          singleSelect
        />
      </WhiteSectionGeneric>

      <WhiteSectionGeneric>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          {baseMapsS}
        </Typography>
        {baseMapRows.length === 0 ? (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {noBaseMapsS}
          </Typography>
        ) : (
          baseMapRows.map((row) => (
            <Box key={row.name} sx={{ mb: 1 }}>
              <Typography variant="body2">
                {row.name}
                {row.existing && (
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    {` (${existingS})`}
                  </Typography>
                )}
              </Typography>
              {row.items.map((item, index) => (
                <Typography
                  key={index}
                  variant="caption"
                  sx={{ display: "block", pl: 2, color: "text.secondary" }}
                >
                  {getBaseMapItemLabel(item)}
                </Typography>
              ))}
            </Box>
          ))
        )}
        {showDisableExisting && (
          <Typography
            variant="caption"
            sx={{ display: "block", mt: 0.5, color: "warning.main" }}
          >
            {disableExistingS}
          </Typography>
        )}
      </WhiteSectionGeneric>

      <WhiteSectionGeneric>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          {librariesS}
        </Typography>
        {libraries.length === 0 ? (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {noLibrariesS}
          </Typography>
        ) : (
          libraries.map((library) => (
            <Box key={library.key} sx={{ mb: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                {library.name}
              </Typography>
              {library.templates.map((template, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    pl: 1,
                    py: 0.5,
                  }}
                >
                  <AnnotationTemplateIcon template={template} size={16} />
                  <Typography variant="caption" noWrap>
                    {template.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          ))
        )}
      </WhiteSectionGeneric>

      <Box sx={{ flexGrow: 1 }} />

      {!projectId && (
        <Typography variant="caption" sx={{ color: "warning.main" }}>
          {noProjectS}
        </Typography>
      )}

      <Tooltip title={hotkeyTooltipS}>
        <span style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            onClick={onCreate}
            disabled={isCreating || !canCreate}
            startIcon={
              isCreating ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
          >
            {createS}
            {/* in-button hotkey chip, same style as ButtonSaveScope's Ctrl+S */}
            {!isCreating && (
              <Typography
                variant="caption"
                sx={{
                  ml: 1,
                  fontSize: "0.6rem",
                  lineHeight: 1,
                  px: 0.5,
                  py: 0.25,
                  border: "1px solid currentColor",
                  borderRadius: 0.5,
                  opacity: 0.7,
                  whiteSpace: "nowrap",
                }}
              >
                C
              </Typography>
            )}
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
}
