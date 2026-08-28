import { useState } from "react";
import { useDispatch } from "react-redux";

import { triggerSelectionBack } from "Features/selection/selectionSlice";

import {
  Box,
  Typography,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from "@mui/material";
import { ArrowBack as Back, FormatSize } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";
import FieldColorV2 from "Features/form/components/FieldColorV2";
import DebouncedTextField from "Features/form/components/DebouncedTextField";

import useSelectedPortfolioPage from "Features/portfolioPages/hooks/useSelectedPortfolioPage";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useTitleBlockManifest from "Features/titleBlocks/hooks/useTitleBlockManifest";
import usePortfolioPageFrame from "Features/portfolios/hooks/usePortfolioPageFrame";
import usePortfolioPages from "Features/portfolioPages/hooks/usePortfolioPages";

import getPageDimensions from "../utils/getPageDimensions";
import getPageLayout from "../utils/getPageLayout";
import resolveTitleFormat, {
  toPersistedTitleFormat,
} from "../utils/resolveTitleFormat";

const FONT_SIZES = [
  { value: 10, iconSize: 13 },
  { value: 12, iconSize: 16 },
  { value: 14, iconSize: 19 },
  { value: 18, iconSize: 22 },
];

// Dedicated properties panel for the page title element (selection type
// PORTFOLIO_TITLE). Back arrow returns to the page panel via the standard
// selection back chain (PORTFOLIO_TITLE -> PORTFOLIO_PAGE).
export default function PanelPortfolioPageTitleProperties() {
  const dispatch = useDispatch();

  // data

  const { value: page } = useSelectedPortfolioPage();
  const updateEntity = useUpdateEntity();
  const { value: portfolio } = useDisplayedPortfolio();
  const titleBlockManifest = useTitleBlockManifest(portfolio);
  const pageFrame = usePortfolioPageFrame();
  const { value: pages } = usePortfolioPages({
    filterByPortfolioId: portfolio?.id,
  });

  // state

  const [applying, setApplying] = useState(false);

  // helpers

  const isFolioPage = page?.type === "FOLIO_PAGE";
  const pageDims = getPageDimensions(page?.format, page?.orientation);
  const titleBar = isFolioPage
    ? null
    : getPageLayout(
        page?.format,
        page?.orientation,
        0,
        titleBlockManifest.height,
        pageFrame
      ).titleBar;

  const resolved = resolveTitleFormat(page, { titleBar, pageDims, pageFrame });

  const similarPages = (pages ?? []).filter(
    (p) =>
      p.id !== page?.id &&
      p.type === page?.type &&
      p.format === page?.format &&
      p.orientation === page?.orientation
  );

  // handlers

  async function updateTitleFormat(patch) {
    if (!page || !portfolio) return;
    await updateEntity(
      page.id,
      { titleFormat: toPersistedTitleFormat(resolved, patch) },
      { listing: portfolio }
    );
  }

  async function handleFontSizeChange(_, value) {
    if (!value) return;
    await updateTitleFormat({ fontSize: Number(value) });
  }

  // copies style + position to similar pages; each page keeps its own
  // customText
  async function handleApplyToSimilarPages() {
    if (!portfolio || applying) return;
    setApplying(true);
    try {
      for (const p of similarPages) {
        await updateEntity(
          p.id,
          {
            titleFormat: toPersistedTitleFormat(resolved, {
              customText: p.titleFormat?.customText ?? "",
            }),
          },
          { listing: portfolio }
        );
      }
    } finally {
      setApplying(false);
    }
  }

  // render

  if (!page) return null;

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          pl: 1,
          flexShrink: 0,
        }}
      >
        <IconButton onClick={() => dispatch(triggerSelectionBack())}>
          <Back />
        </IconButton>

        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Titre
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {page.title ?? "-?-"}
          </Typography>
        </Box>
      </Box>

      <BoxFlexVStretch sx={{ overflowY: "auto" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5 }}>
          <FieldCheck
            value={resolved.show}
            onChange={(checked) => updateTitleFormat({ show: checked })}
            label="Afficher le titre"
            options={{ type: "switch", showAsField: true }}
          />

          {resolved.show && (
            <>
              <FieldCheck
                value={resolved.prefixPortfolioName}
                onChange={(checked) =>
                  updateTitleFormat({ prefixPortfolioName: checked })
                }
                label="Préfixe : nom du carnet"
                options={{ type: "switch", showAsSection: true }}
              />

              <FieldCheck
                value={resolved.suffixPageName}
                onChange={(checked) =>
                  updateTitleFormat({ suffixPageName: checked })
                }
                label="Suffixe : nom de la page"
                options={{ type: "switch", showAsSection: true }}
              />

              <WhiteSectionGeneric>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Titre personnalisé
                </Typography>
                <DebouncedTextField
                  size="small"
                  fullWidth
                  value={resolved.customText}
                  onChange={(value) => updateTitleFormat({ customText: value })}
                />
              </WhiteSectionGeneric>

              <FieldColorV2
                label="Couleur"
                value={resolved.color}
                onChange={(color) => updateTitleFormat({ color })}
                options={{ showAsSection: true }}
              />

              <WhiteSectionGeneric>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Taille
                </Typography>
                <ToggleButtonGroup
                  value={String(resolved.fontSize)}
                  exclusive
                  onChange={handleFontSizeChange}
                  size="small"
                  fullWidth
                >
                  {FONT_SIZES.map((s) => (
                    <ToggleButton key={s.value} value={String(s.value)}>
                      <FormatSize sx={{ fontSize: s.iconSize }} />
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </WhiteSectionGeneric>

              <FieldCheck
                value={resolved.underline}
                onChange={(checked) =>
                  updateTitleFormat({ underline: checked })
                }
                label="Souligné"
                options={{ type: "switch", showAsSection: true }}
              />

              <WhiteSectionGeneric>
                <ButtonInPanelV2
                  label={`Appliquer sur les pages similaires (${similarPages.length})`}
                  variant="outlined"
                  startIcon={applying ? <CircularProgress size={20} /> : null}
                  disabled={applying || similarPages.length === 0}
                  onClick={handleApplyToSimilarPages}
                />
              </WhiteSectionGeneric>
            </>
          )}
        </Box>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
