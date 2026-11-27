import { useRef } from "react";

import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import {
  Image as ImageIcon,
  AddPhotoAlternate,
  Delete,
} from "@mui/icons-material";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import usePortfolioLogoUrl from "Features/portfolios/hooks/usePortfolioLogoUrl";
import useTitleBlockManifest from "Features/titleBlocks/hooks/useTitleBlockManifest";
import useDataMapping from "Features/appConfig/hooks/useDataMapping";
import usePortfolioPageFrame from "Features/portfolios/hooks/usePortfolioPageFrame";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import DebouncedTextField from "Features/form/components/DebouncedTextField";
import FieldCheck from "Features/form/components/FieldCheck";
import TitleBlockFieldsForm from "Features/titleBlocks/components/TitleBlockFieldsForm";
import IconButtonMoreActionsPortfolio from "./IconButtonMoreActionsPortfolio";

import resolveTitleBlockFields from "Features/titleBlocks/utils/resolveTitleBlockFields";
import getTitleBlockPlaceholders from "Features/titleBlocks/utils/getTitleBlockPlaceholders";

import db from "App/db/db";

export default function PanelPortfolioHeaderProperties() {
  // strings

  const showTitleBlockS = "Afficher le cartouche";
  const showFrameS = "Afficher le cadre";
  const logoS = "Logo";
  const addLogoS = "Ajouter un logo";
  const changeLogoS = "Changer le logo";
  const deleteLogoS = "Supprimer le logo";

  // data

  const { value: portfolio } = useDisplayedPortfolio();
  const fileInputRef = useRef(null);

  // helpers

  const config = portfolio?.metadata || {};
  const manifest = useTitleBlockManifest(portfolio);
  const { object: dataMapping } = useDataMapping();
  const pageFrame = usePortfolioPageFrame();
  const logoUrl = usePortfolioLogoUrl(config.logo);
  const resolvedLogoSrc =
    logoUrl || (typeof config.logo === "string" ? config.logo : null);

  const titleBlockValues = resolveTitleBlockFields(manifest, config);
  const labelCells = (manifest.cells || []).filter(
    (cell) => cell.kind === "label" && cell.legacyLabelKey
  );

  // handlers

  async function updateConfig(patch) {
    if (!portfolio) return;
    const updated = { ...config, ...patch };
    await db.listings.update(portfolio.id, { metadata: updated });
  }

  // Writes go to metadata.titleBlock.values; the full resolved set is
  // persisted so legacy metadata fields migrate on first edit.
  async function handleTitleBlockFieldChange(key, val) {
    await updateConfig({
      titleBlock: {
        key: config.titleBlock?.key ?? manifest.key,
        values: { ...titleBlockValues, [key]: val },
      },
    });
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateConfig({ logo: reader.result });
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // render

  if (!portfolio) return null;

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 0.5,
          pl: 1,
        }}
      >
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Carnet de plans
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {portfolio.name || "Carnet de plans"}
          </Typography>
        </Box>

        <IconButtonMoreActionsPortfolio portfolio={portfolio} />
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          p: 1.5,
          overflow: "auto",
        }}
      >
        {/* Title block (cartouche) visibility: only the drawing is hidden,
            the page layout is unchanged */}
        <FieldCheck
          value={!config.hideTitleBlock}
          onChange={(checked) => updateConfig({ hideTitleBlock: !checked })}
          label={showTitleBlockS}
          options={{ type: "switch", showAsField: true }}
        />

        {/* Page frame (only when the org config defines one). Hiding it
            only removes the drawn lines: page margins are unchanged. */}
        {pageFrame && (
          <FieldCheck
            value={!config.hidePageFrame}
            onChange={(checked) => updateConfig({ hidePageFrame: !checked })}
            label={showFrameS}
            options={{ type: "switch", showAsField: true }}
          />
        )}

        {/* Logo: single dense row (label, thumbnail, icon actions) */}
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {logoS}
            </Typography>
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              {resolvedLogoSrc && (
                <Box
                  component="img"
                  src={resolvedLogoSrc}
                  sx={{ maxWidth: 96, maxHeight: 28, objectFit: "contain" }}
                />
              )}
            </Box>
            <Tooltip title={resolvedLogoSrc ? changeLogoS : addLogoS}>
              <IconButton size="small" component="label">
                {resolvedLogoSrc ? (
                  <ImageIcon fontSize="small" />
                ) : (
                  <AddPhotoAlternate fontSize="small" />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleLogoUpload}
                />
              </IconButton>
            </Tooltip>
            {resolvedLogoSrc && (
              <Tooltip title={deleteLogoS}>
                <IconButton
                  size="small"
                  onClick={() => updateConfig({ logo: null })}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </WhiteSectionGeneric>

        {/* Main fields */}
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Champs principaux
            </Typography>
            <DebouncedTextField
              label={config.labelPortfolio || "Carnet"}
              size="small"
              value={portfolio.name || ""}
              onChange={(val) =>
                db.listings.update(portfolio.id, { name: val })
              }
              fullWidth
            />
          </Box>
        </WhiteSectionGeneric>

        {/* Title block fields (manifest-driven) */}
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Champs secondaires
            </Typography>
            <TitleBlockFieldsForm
              manifest={manifest}
              values={titleBlockValues}
              onChange={handleTitleBlockFieldChange}
              placeholders={getTitleBlockPlaceholders(manifest, dataMapping)}
            />
          </Box>
        </WhiteSectionGeneric>

        {/* Label customization (legacy label* metadata keys, read by the
            manifest cells via legacyLabelKey) */}
        {labelCells.length > 0 && (
          <WhiteSectionGeneric>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                Titres des champs
              </Typography>
              {labelCells.map((cell) => (
                <DebouncedTextField
                  key={cell.legacyLabelKey}
                  label={`Titre: ${cell.text}`}
                  size="small"
                  value={config[cell.legacyLabelKey] || cell.text}
                  onChange={(val) =>
                    updateConfig({ [cell.legacyLabelKey]: val })
                  }
                  fullWidth
                />
              ))}
            </Box>
          </WhiteSectionGeneric>
        )}
      </Box>
    </BoxFlexVStretch>
  );
}
