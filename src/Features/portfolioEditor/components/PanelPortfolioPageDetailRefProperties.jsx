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
import {
  ArrowBack as Back,
  FormatSize,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  VerticalAlignTop,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";
import DebouncedTextField from "Features/form/components/DebouncedTextField";

import useSelectedPortfolioPage from "Features/portfolioPages/hooks/useSelectedPortfolioPage";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import usePortfolioPageFrame from "Features/portfolios/hooks/usePortfolioPageFrame";
import usePortfolioPages from "Features/portfolioPages/hooks/usePortfolioPages";

import getPageDimensions from "../utils/getPageDimensions";
import resolveTitleFormat from "../utils/resolveTitleFormat";
import resolveDetailRefFormat, {
  toPersistedDetailRefFormat,
} from "../utils/resolveDetailRefFormat";

const FONT_SIZES = [
  { value: 10, iconSize: 13 },
  { value: 12, iconSize: 16 },
  { value: 14, iconSize: 19 },
  { value: 18, iconSize: 22 },
];

const ALIGNS = [
  { value: "left", Icon: FormatAlignLeft },
  { value: "center", Icon: FormatAlignCenter },
  { value: "right", Icon: FormatAlignRight },
];

// Dedicated properties panel for the folio page's detail reference element
// (selection type PORTFOLIO_DETAIL_REF). Back arrow returns to the page
// panel via the standard selection back chain.
export default function PanelPortfolioPageDetailRefProperties() {
  const dispatch = useDispatch();

  // data

  const { value: page } = useSelectedPortfolioPage();
  const updateEntity = useUpdateEntity();
  const { value: portfolio } = useDisplayedPortfolio();
  const pageFrame = usePortfolioPageFrame();
  const { value: pages } = usePortfolioPages({
    filterByPortfolioId: portfolio?.id,
  });

  // state

  const [applying, setApplying] = useState(false);

  // helpers

  const pageDims = getPageDimensions(page?.format, page?.orientation);
  const resolved = resolveDetailRefFormat(page, { pageDims, pageFrame });

  const similarPages = (pages ?? []).filter(
    (p) =>
      p.id !== page?.id &&
      p.type === page?.type &&
      p.format === page?.format &&
      p.orientation === page?.orientation
  );

  // handlers

  async function updateDetailRefFormat(patch) {
    if (!page || !portfolio) return;
    await updateEntity(
      page.id,
      { detailRefFormat: toPersistedDetailRefFormat(resolved, patch) },
      { listing: portfolio }
    );
  }

  async function handleAlignChange(_, value) {
    if (!value) return;
    await updateDetailRefFormat({ align: value });
  }

  async function handleFontSizeChange(_, value) {
    if (!value) return;
    await updateDetailRefFormat({ fontSize: Number(value) });
  }

  // moves the reference onto the title's strip (folio pages have no layout
  // titleBar, so the title resolver yields its stored / default rect)
  async function handleAlignOnTitle() {
    const titleResolved = resolveTitleFormat(page, {
      titleBar: null,
      pageDims,
      pageFrame,
    });
    const r = titleResolved.rect;
    await updateDetailRefFormat({ x: r.x, y: r.y, width: r.width });
  }

  // copies style + position to similar folio pages (the reference number
  // itself resolves per-page from the source annotation)
  async function handleApplyToSimilarPages() {
    if (!portfolio || applying) return;
    setApplying(true);
    try {
      for (const p of similarPages) {
        await updateEntity(
          p.id,
          { detailRefFormat: toPersistedDetailRefFormat(resolved) },
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
            Référence du détail
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
            onChange={(checked) => updateDetailRefFormat({ show: checked })}
            label="Afficher la référence"
            options={{ type: "switch", showAsField: true }}
          />

          {resolved.show && (
            <>
              <WhiteSectionGeneric>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Alignement du texte
                </Typography>
                <ToggleButtonGroup
                  value={resolved.align}
                  exclusive
                  onChange={handleAlignChange}
                  size="small"
                  fullWidth
                >
                  {ALIGNS.map(({ value, Icon }) => (
                    <ToggleButton key={value} value={value}>
                      <Icon sx={{ fontSize: 18 }} />
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </WhiteSectionGeneric>

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

              <WhiteSectionGeneric>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Préfixe au numéro
                </Typography>
                <DebouncedTextField
                  size="small"
                  fullWidth
                  value={resolved.prefix}
                  onChange={(value) => updateDetailRefFormat({ prefix: value })}
                />
              </WhiteSectionGeneric>

              <FieldCheck
                value={resolved.uppercase}
                onChange={(checked) =>
                  updateDetailRefFormat({ uppercase: checked })
                }
                label="Mettre en majuscule"
                options={{ type: "switch", showAsSection: true }}
              />

              <WhiteSectionGeneric>
                <ButtonInPanelV2
                  label="Aligner sur le titre"
                  variant="outlined"
                  startIcon={<VerticalAlignTop />}
                  onClick={handleAlignOnTitle}
                />
              </WhiteSectionGeneric>

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
