import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
} from "@mui/material";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import db from "App/db/db";

export default function PanelPortfolioHeaderProperties() {
  // data

  const { value: portfolio } = useDisplayedPortfolio();

  // helpers

  const config = portfolio?.headerConfig || {};

  // handlers

  async function updateConfig(patch) {
    if (!portfolio) return;
    const updated = { ...config, ...patch };
    await db.portfolios.update(portfolio.id, { headerConfig: updated });
  }

  async function handleTitleChange(e) {
    if (!portfolio) return;
    await db.portfolios.update(portfolio.id, { title: e.target.value });
  }

  // render

  if (!portfolio) return null;

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="subtitle2">Cartouche</Typography>

        <TextField
          label="Titre (chantier)"
          size="small"
          value={portfolio.title || ""}
          onChange={handleTitleChange}
          fullWidth
        />

        <TextField
          label="Auteur"
          size="small"
          value={config.author || ""}
          onChange={(e) => updateConfig({ author: e.target.value })}
          fullWidth
        />

        <TextField
          label="Date"
          size="small"
          value={config.date || ""}
          onChange={(e) => updateConfig({ date: e.target.value })}
          fullWidth
        />

        <TextField
          label="Ref. interne"
          size="small"
          value={config.refInterne || ""}
          onChange={(e) => updateConfig({ refInterne: e.target.value })}
          fullWidth
        />

        <FormControl fullWidth size="small">
          <InputLabel>Position</InputLabel>
          <Select
            value={config.position || "bottom-right"}
            label="Position"
            onChange={(e) => updateConfig({ position: e.target.value })}
          >
            <MenuItem value="bottom-right">Bas-droite</MenuItem>
            <MenuItem value="bottom-left">Bas-gauche</MenuItem>
            <MenuItem value="top-right">Haut-droite</MenuItem>
            <MenuItem value="top-left">Haut-gauche</MenuItem>
          </Select>
        </FormControl>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Visibility
        </Typography>

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={config.showTitle !== false}
              onChange={(e) =>
                updateConfig({ showTitle: e.target.checked })
              }
            />
          }
          label="Titre"
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={config.showPageTitle !== false}
              onChange={(e) =>
                updateConfig({ showPageTitle: e.target.checked })
              }
            />
          }
          label="Titre de page"
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={config.showAuthor !== false}
              onChange={(e) =>
                updateConfig({ showAuthor: e.target.checked })
              }
            />
          }
          label="Auteur"
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={config.showDate !== false}
              onChange={(e) =>
                updateConfig({ showDate: e.target.checked })
              }
            />
          }
          label="Date"
        />
      </Box>
    </BoxFlexVStretch>
  );
}
