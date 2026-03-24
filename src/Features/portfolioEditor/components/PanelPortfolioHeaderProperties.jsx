import { useRef, useState } from "react";

import { Box, Typography, TextField, Button, IconButton, FormControlLabel, Checkbox } from "@mui/material";
import { Image as ImageIcon, Delete } from "@mui/icons-material";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import usePortfolioLogoUrl from "Features/portfolios/hooks/usePortfolioLogoUrl";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import DebouncedTextField from "Features/form/components/DebouncedTextField";
import IconButtonMoreActionsPortfolio from "./IconButtonMoreActionsPortfolio";
import ButtonDownloadPortfolioPdf from "./ButtonDownloadPortfolioPdf";

import db from "App/db/db";

export default function PanelPortfolioHeaderProperties() {
  // data

  const { value: portfolio } = useDisplayedPortfolio();
  const { value: project } = useSelectedProject();
  const fileInputRef = useRef(null);
  const [hdExport, setHdExport] = useState(false);

  // helpers

  const config = portfolio?.metadata || {};
  const logoUrl = usePortfolioLogoUrl(config.logo);
  const resolvedLogoSrc =
    logoUrl || (typeof config.logo === "string" ? config.logo : null);
  const chantierValue = project?.name || "";

  // handlers

  async function updateConfig(patch) {
    if (!portfolio) return;
    const updated = { ...config, ...patch };
    await db.listings.update(portfolio.id, { metadata: updated });
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
            Portfolio
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {portfolio.name || "Portfolio"}
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
        {/* Export */}
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Export
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={hdExport}
                  onChange={(e) => setHdExport(e.target.checked)}
                />
              }
              label="Haute définition"
              slotProps={{ typography: { variant: "body2" } }}
            />
            <ButtonDownloadPortfolioPdf hdExport={hdExport} />
          </Box>
        </WhiteSectionGeneric>

        {/* Logo */}
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Logo
            </Typography>
            {resolvedLogoSrc && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  component="img"
                  src={resolvedLogoSrc}
                  sx={{ maxWidth: 60, maxHeight: 40, objectFit: "contain" }}
                />
                <IconButton
                  size="small"
                  onClick={() => updateConfig({ logo: null })}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            )}
            <Button
              variant="outlined"
              size="small"
              component="label"
              startIcon={<ImageIcon />}
            >
              {resolvedLogoSrc ? "Changer" : "Ajouter"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleLogoUpload}
              />
            </Button>
          </Box>
        </WhiteSectionGeneric>

        {/* Main fields */}
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Champs principaux
            </Typography>
            <TextField
              label={config.labelChantier || "Chantier"}
              size="small"
              value={chantierValue}
              disabled
              fullWidth
              helperText="Valeur automatique (projet)"
            />
            <DebouncedTextField
              label={config.labelPortfolio || "Portfolio"}
              size="small"
              value={portfolio.name || ""}
              onChange={(val) =>
                db.listings.update(portfolio.id, { name: val })
              }
              fullWidth
            />
          </Box>
        </WhiteSectionGeneric>

        {/* Meta fields */}
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Champs secondaires
            </Typography>
            <DebouncedTextField
              label={config.labelRefInterne || "Numéro"}
              size="small"
              value={config.refInterne || ""}
              onChange={(val) => updateConfig({ refInterne: val })}
              fullWidth
            />
            <DebouncedTextField
              label={config.labelAuteur || "Auteur"}
              size="small"
              value={config.author || ""}
              onChange={(val) => updateConfig({ author: val })}
              fullWidth
            />
            <DebouncedTextField
              label={config.labelDate || "Date"}
              size="small"
              value={config.date || ""}
              onChange={(val) => updateConfig({ date: val })}
              fullWidth
            />
          </Box>
        </WhiteSectionGeneric>

        {/* Label customization */}
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Titres des champs
            </Typography>
            <DebouncedTextField
              label="Titre: Chantier"
              size="small"
              value={config.labelChantier || "Chantier"}
              onChange={(val) => updateConfig({ labelChantier: val })}
              fullWidth
            />
            <DebouncedTextField
              label="Titre: Portfolio"
              size="small"
              value={config.labelPortfolio || "Portfolio"}
              onChange={(val) => updateConfig({ labelPortfolio: val })}
              fullWidth
            />
            <DebouncedTextField
              label="Titre: Page"
              size="small"
              value={config.labelPage || "Page"}
              onChange={(val) => updateConfig({ labelPage: val })}
              fullWidth
            />
            <DebouncedTextField
              label="Titre: Numéro"
              size="small"
              value={config.labelRefInterne || "Numéro"}
              onChange={(val) => updateConfig({ labelRefInterne: val })}
              fullWidth
            />
            <DebouncedTextField
              label="Titre: Auteur"
              size="small"
              value={config.labelAuteur || "Auteur"}
              onChange={(val) => updateConfig({ labelAuteur: val })}
              fullWidth
            />
            <DebouncedTextField
              label="Titre: Date"
              size="small"
              value={config.labelDate || "Date"}
              onChange={(val) => updateConfig({ labelDate: val })}
              fullWidth
            />
          </Box>
        </WhiteSectionGeneric>

      </Box>
    </BoxFlexVStretch>
  );
}
