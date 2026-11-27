import { useState } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import {
  Button,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { FormatSize, AlignHorizontalRight } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelTitle from "Features/layout/components/PanelTitle";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";
import SectionLegendManualQties from "Features/legend/components/SectionLegendManualQties";

import useLegendItemsByBaseMapId from "Features/legend/hooks/useLegendItemsByBaseMapId";
import useAnnotationTemplateQtiesByIdForBaseMap from "Features/annotations/hooks/useAnnotationTemplateQtiesByIdForBaseMap";
import usePortfolioPageFrame from "Features/portfolios/hooks/usePortfolioPageFrame";
import parseMainQtyLabel from "Features/legend/utils/parseMainQtyLabel";
import getPageDimensions from "../utils/getPageDimensions";
import { resolveLegendFormat } from "../utils/getDefaultLegendFormat";
import alignLegendsOnLegendService, {
  getOtherPagesLegendContainers,
} from "../services/alignLegendsOnLegendService";

import db from "App/db/db";

export default function PanelLegendBlockProperties() {
  // data

  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems.find((i) => i.type === "LEGEND_BLOCK");
  const containerId = selectedItem?.id;

  const container = useLiveQuery(async () => {
    if (!containerId) return null;
    const record = await db.portfolioBaseMapContainers.get(containerId);
    if (!record || record.deletedAt) return null;
    return record;
  }, [containerId]);

  const pageFrame = usePortfolioPageFrame();

  // page of the legend + number of legends on the other pages
  const pageInfo = useLiveQuery(async () => {
    if (!container?.portfolioPageId) return null;
    const page = await db.portfolioPages.get(container.portfolioPageId);
    if (!page || page.deletedAt) return null;
    const others = await getOtherPagesLegendContainers(page);
    return { page, otherLegendsCount: others.length };
  }, [container?.portfolioPageId]);

  // state

  const [aligning, setAligning] = useState(false);

  // Same hooks + params as LegendBlockSvg so the panel lists the exact
  // rendered legend items and quantities.
  const legendItems = useLegendItemsByBaseMapId(container?.baseMapId, {
    viewBox: container?.viewBox,
    disabledAnnotationTemplates: container?.disabledAnnotationTemplates,
    disabledLayerIds: container?.disabledLayerIds,
    hideHeight: container?.legendFormat?.hideHeight,
  });
  const qtiesById = useAnnotationTemplateQtiesByIdForBaseMap(
    container?.baseMapId,
    {
      viewBox: container?.viewBox,
      disabledAnnotationTemplates: container?.disabledAnnotationTemplates,
      disabledLayerIds: container?.disabledLayerIds,
    }
  );

  // render

  if (!container) return null;

  // helpers

  const page = pageInfo?.page;
  const otherLegendsCount = pageInfo?.otherLegendsCount ?? 0;
  const legendFormat = resolveLegendFormat(container, {
    pageDims: page ? getPageDimensions(page.format, page.orientation) : null,
    pageFrame,
  });
  const showQty = legendFormat.showQty ?? true;
  const hideHeight = legendFormat.hideHeight ?? false;
  const fontSize = legendFormat.fontSize || 12;
  const hardCodedQtiesById = legendFormat.hardCodedQtiesById ?? {};

  const manualQtyRows = (legendItems ?? [])
    .filter((it) => it.id)
    .map((it) => {
      const computedLabel = qtiesById?.[it.id]?.mainQtyLabel ?? "";
      const { value: computedValue, unit: parsedUnit } =
        parseMainQtyLabel(computedLabel);
      const unit = qtiesById?.[it.id]?.mainQtyUnit ?? parsedUnit;
      return { id: it.id, label: it.label, computedValue, unit, computedLabel };
    });

  // handlers

  async function handleToggleShowQty(checked) {
    await db.portfolioBaseMapContainers.update(container.id, {
      legendFormat: { ...legendFormat, showQty: checked },
    });
  }

  async function handleToggleHideHeight(checked) {
    await db.portfolioBaseMapContainers.update(container.id, {
      legendFormat: { ...legendFormat, hideHeight: checked },
    });
  }

  async function handleFontSizeChange(_, value) {
    if (!value) return;
    await db.portfolioBaseMapContainers.update(container.id, {
      legendFormat: { ...legendFormat, fontSize: Number(value) },
    });
  }

  async function handleHardCodedQtyChange(templateId, value) {
    const next = { ...hardCodedQtiesById };
    if (value == null) delete next[templateId];
    else next[templateId] = value;
    await db.portfolioBaseMapContainers.update(container.id, {
      legendFormat: { ...legendFormat, hardCodedQtiesById: next },
    });
  }

  // Aligns the legends of the other pages on this one (corner the closest
  // to the page corner the legend sits in). Rendered heights come from the
  // DOM: every page of the portfolio is mounted in the editor viewport.
  async function handleAlignOtherLegends() {
    if (!page || aligning) return;
    setAligning(true);
    try {
      const heightById = {};
      document.querySelectorAll("[data-legend-container-id]").forEach((el) => {
        const height = Number(el.dataset.legendHeight);
        if (height > 0) heightById[el.dataset.legendContainerId] = height;
      });
      await alignLegendsOnLegendService({
        container,
        page,
        pageFrame,
        heightById,
      });
    } finally {
      setAligning(false);
    }
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

        <FieldCheck
          value={hideHeight}
          onChange={handleToggleHideHeight}
          label="Masquer la hauteur"
          options={{ type: "switch", showAsSection: true }}
        />

        {otherLegendsCount > 0 && (
          <WhiteSectionGeneric>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Position
            </Typography>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              startIcon={<AlignHorizontalRight />}
              disabled={aligning}
              onClick={handleAlignOtherLegends}
            >
              {`Aligner les autres légendes (${otherLegendsCount})`}
            </Button>
          </WhiteSectionGeneric>
        )}

        <WhiteSectionGeneric>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Quantités manuelles
          </Typography>
          <SectionLegendManualQties
            rows={manualQtyRows}
            hardCodedQtiesById={hardCodedQtiesById}
            onChange={handleHardCodedQtyChange}
          />
        </WhiteSectionGeneric>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
