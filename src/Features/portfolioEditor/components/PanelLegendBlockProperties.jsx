import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import {
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { FormatSize } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelTitle from "Features/layout/components/PanelTitle";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";

import db from "App/db/db";

export default function PanelLegendBlockProperties() {
  // data

  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems.find(
    (i) => i.type === "LEGEND_BLOCK"
  );
  const containerId = selectedItem?.id;

  const container = useLiveQuery(async () => {
    if (!containerId) return null;
    const record = await db.portfolioBaseMapContainers.get(containerId);
    if (!record || record.deletedAt) return null;
    return record;
  }, [containerId]);

  // render

  if (!container) return null;

  // helpers

  const legendFormat = container.legendFormat ?? {
    x: container.x + container.width - 280 - 16,
    y: container.y + 16,
    width: 280,
    fontSize: 12,
    showQty: true,
  };
  const showQty = legendFormat.showQty ?? true;
  const fontSize = legendFormat.fontSize || 12;

  // handlers

  async function handleToggleShowQty(checked) {
    await db.portfolioBaseMapContainers.update(container.id, {
      legendFormat: { ...legendFormat, showQty: checked },
    });
  }

  async function handleFontSizeChange(_, value) {
    if (!value) return;
    await db.portfolioBaseMapContainers.update(container.id, {
      legendFormat: { ...legendFormat, fontSize: Number(value) },
    });
  }

  return (
    <BoxFlexVStretch>
      <PanelTitle title="Légende" />

      <BoxFlexVStretch sx={{ gap: 1, p: 1 }}>
        <WhiteSectionGeneric>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Taille
          </Typography>
          <ToggleButtonGroup
            value={String(fontSize)}
            exclusive
            onChange={handleFontSizeChange}
            size="small"
            fullWidth
          >
            <ToggleButton value="10">
              <FormatSize sx={{ fontSize: 14 }} />
            </ToggleButton>
            <ToggleButton value="12">
              <FormatSize sx={{ fontSize: 18 }} />
            </ToggleButton>
            <ToggleButton value="14">
              <FormatSize sx={{ fontSize: 22 }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </WhiteSectionGeneric>

        <FieldCheck
          value={showQty}
          onChange={handleToggleShowQty}
          label="Afficher les quantités"
          options={{ type: "switch", showAsSection: true }}
        />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
