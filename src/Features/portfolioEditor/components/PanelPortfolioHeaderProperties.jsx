import { useRef } from "react";

import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Divider,
} from "@mui/material";
import { Image as ImageIcon, Delete } from "@mui/icons-material";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import usePortfolioLogoUrl from "Features/portfolios/hooks/usePortfolioLogoUrl";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import db from "App/db/db";

export default function PanelPortfolioHeaderProperties() {
  // data

  const { value: portfolio } = useDisplayedPortfolio();
  const { value: project } = useSelectedProject();
  const fileInputRef = useRef(null);

  // helpers

  const config = portfolio?.headerConfig || {};
  const logoUrl = usePortfolioLogoUrl(config.logo);
  const chantierValue = project?.name || "";

  // handlers

  async function updateConfig(patch) {
    if (!portfolio) return;
    const updated = { ...config, ...patch };
    await db.portfolios.update(portfolio.id, { headerConfig: updated });
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !portfolio) return;

    const fileName = `logo_${portfolio.id}.${file.name.split(".").pop() || "png"}`;
    const fileArrayBuffer = await file.arrayBuffer();

    await db.files.put({
      fileName,
      srcFileName: file.name,
      fileMime: file.type,
      fileType: "IMAGE",
      fileArrayBuffer,
      projectId: portfolio.projectId,
    });

    updateConfig({ logo: { fileName, isImage: true } });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleLogoDelete() {
    if (config.logo?.fileName) {
      await db.files.delete(config.logo.fileName);
    }
    updateConfig({ logo: null });
  }

  // render

  if (!portfolio) return null;

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="subtitle2">Cartouche</Typography>

        {/* Logo */}
        <Divider />
        <Typography variant="body2" color="text.secondary">
          Logo
        </Typography>
        {logoUrl && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              component="img"
              src={logoUrl}
              sx={{ maxWidth: 60, maxHeight: 40, objectFit: "contain" }}
            />
            <IconButton
              size="small"
              onClick={handleLogoDelete}
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
          {logoUrl ? "Changer" : "Ajouter"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleLogoUpload}
          />
        </Button>

        {/* Main fields */}
        <Divider />
        <Typography variant="body2" color="text.secondary">
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

        <TextField
          label={config.labelPortfolio || "Portfolio"}
          size="small"
          value={portfolio.title || ""}
          onChange={async (e) =>
            db.portfolios.update(portfolio.id, { title: e.target.value })
          }
          fullWidth
        />

        {/* Meta fields */}
        <Divider />
        <Typography variant="body2" color="text.secondary">
          Champs secondaires
        </Typography>

        <TextField
          label={config.labelRefInterne || "Ref. Interne"}
          size="small"
          value={config.refInterne || ""}
          onChange={(e) => updateConfig({ refInterne: e.target.value })}
          fullWidth
        />
        <TextField
          label={config.labelAuteur || "Auteur"}
          size="small"
          value={config.author || ""}
          onChange={(e) => updateConfig({ author: e.target.value })}
          fullWidth
        />
        <TextField
          label={config.labelDate || "Date"}
          size="small"
          value={config.date || ""}
          onChange={(e) => updateConfig({ date: e.target.value })}
          fullWidth
        />

        {/* Label customization */}
        <Divider />
        <Typography variant="body2" color="text.secondary">
          Titres des champs
        </Typography>

        <TextField
          label="Titre: Chantier"
          size="small"
          value={config.labelChantier || "Chantier"}
          onChange={(e) => updateConfig({ labelChantier: e.target.value })}
          fullWidth
        />
        <TextField
          label="Titre: Portfolio"
          size="small"
          value={config.labelPortfolio || "Portfolio"}
          onChange={(e) => updateConfig({ labelPortfolio: e.target.value })}
          fullWidth
        />
        <TextField
          label="Titre: Page"
          size="small"
          value={config.labelPage || "Page"}
          onChange={(e) => updateConfig({ labelPage: e.target.value })}
          fullWidth
        />
        <TextField
          label="Titre: Ref. Interne"
          size="small"
          value={config.labelRefInterne || "Ref. Interne"}
          onChange={(e) => updateConfig({ labelRefInterne: e.target.value })}
          fullWidth
        />
        <TextField
          label="Titre: Auteur"
          size="small"
          value={config.labelAuteur || "Auteur"}
          onChange={(e) => updateConfig({ labelAuteur: e.target.value })}
          fullWidth
        />
        <TextField
          label="Titre: Date"
          size="small"
          value={config.labelDate || "Date"}
          onChange={(e) => updateConfig({ labelDate: e.target.value })}
          fullWidth
        />
      </Box>
    </BoxFlexVStretch>
  );
}
