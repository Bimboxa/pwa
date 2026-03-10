import { useDispatch } from "react-redux";

import { triggerSelectionBack } from "Features/selection/selectionSlice";

import useSelectedBaseMapContainer from "Features/portfolioBaseMapContainers/hooks/useSelectedBaseMapContainer";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useBaseMap from "Features/baseMaps/hooks/useBaseMap";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useLegendItemsByBaseMapId from "Features/legend/hooks/useLegendItemsByBaseMapId";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldSlider from "Features/form/components/FieldSlider";
import IconButtonMoreActionsBaseMapContainer from "./IconButtonMoreActionsBaseMapContainer";
import SectionAnnotationVisibility from "./SectionAnnotationVisibility";

import db from "App/db/db";
import computeDefaultViewBox from "../utils/computeDefaultViewBox";

export default function PanelBaseMapContainerProperties() {
  const dispatch = useDispatch();

  // strings

  const caption = "Bloc fond de plan";

  // data

  const { value: container } = useSelectedBaseMapContainer();
  const { value: baseMaps } = useBaseMaps();
  const baseMap = useBaseMap({ id: container?.baseMapId });
  const updateEntity = useUpdateEntity();
  const { value: portfolio } = useDisplayedPortfolio();
  const spriteImage = useAnnotationSpriteImage();

  const viewBox = container?.viewBox;
  const allLegendItems = useLegendItemsByBaseMapId(container?.baseMapId, {
    viewBox,
    includeHidden: true,
  });

  // helpers

  const versions = baseMap?.versions;
  const hasMultipleVersions = versions && versions.length > 1;
  const sortedVersions = hasMultipleVersions
    ? [...versions].sort((a, b) =>
        (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
      )
    : [];

  // handlers

  async function handleOpacityChange(value) {
    await db.portfolioBaseMapContainers.update(container.id, {
      baseMapOpacity: value,
    });
  }

  async function handleVersionChange(e) {
    const versionId = e.target.value || null;
    await db.portfolioBaseMapContainers.update(container.id, { versionId });
  }

  async function handleBaseMapChange(e) {
    const baseMapId = e.target.value || null;
    const bm = baseMaps?.find((b) => b.id === baseMapId);
    const vb = bm ? computeDefaultViewBox(bm, container) : null;
    await db.portfolioBaseMapContainers.update(container.id, {
      baseMapId,
      viewBox: vb,
      versionId: null,
    });

    // rename page title to baseMap name on first assignment
    if (bm && container?.portfolioPageId && !container.baseMapId && portfolio) {
      const page = await db.portfolioPages.get(container.portfolioPageId);
      if (
        page &&
        (page.title === "Page 1" || page.title === "Nouvelle page")
      ) {
        await updateEntity(page.id, { title: bm.name }, { listing: portfolio });
      }
    }
  }

  async function handleToggleTemplate(templateId) {
    const disabled = container.disabledAnnotationTemplates || [];
    const isDisabled = disabled.includes(templateId);
    const updated = isDisabled
      ? disabled.filter((id) => id !== templateId)
      : [...disabled, templateId];
    await db.portfolioBaseMapContainers.update(container.id, {
      disabledAnnotationTemplates: updated,
    });
  }

  async function handleToggleListing(listingName) {
    const disabled = container.disabledAnnotationTemplates || [];
    // Get all template IDs for this listing
    const templateIds = allLegendItems
      .filter((item) => item.listingName === listingName)
      .map((item) => item.id);
    // If all are disabled, enable all; otherwise disable all
    const allDisabled = templateIds.every((id) => disabled.includes(id));
    let updated;
    if (allDisabled) {
      updated = disabled.filter((id) => !templateIds.includes(id));
    } else {
      const toAdd = templateIds.filter((id) => !disabled.includes(id));
      updated = [...disabled, ...toAdd];
    }
    await db.portfolioBaseMapContainers.update(container.id, {
      disabledAnnotationTemplates: updated,
    });
  }

  // render

  if (!container) return null;

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
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton onClick={() => dispatch(triggerSelectionBack())}>
            <Back />
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: "bold", ml: 1 }}>
            {caption}
          </Typography>
        </Box>

        <IconButtonMoreActionsBaseMapContainer container={container} />
      </Box>

      <Box sx={{ p: 1 }}>
        <WhiteSectionGeneric>
          <FormControl fullWidth size="small">
            <InputLabel>Base map</InputLabel>
            <Select
              value={container.baseMapId || ""}
              label="Base map"
              onChange={handleBaseMapChange}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {baseMaps?.map((bm) => (
                <MenuItem key={bm.id} value={bm.id}>
                  {bm.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {hasMultipleVersions && (
            <FormControl fullWidth size="small" sx={{ mt: 1.5 }}>
              <InputLabel>Version</InputLabel>
              <Select
                value={container.versionId || ""}
                label="Version"
                onChange={handleVersionChange}
              >
                <MenuItem value="">
                  <em>Active version</em>
                </MenuItem>
                {sortedVersions.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.label || "Version"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {Math.round(container.width)} x {Math.round(container.height)} pt
          </Typography>
        </WhiteSectionGeneric>

        <Box sx={{ mt: 1 }}>
          <WhiteSectionGeneric>
            <FieldSlider
              label="Opacité"
              value={container.baseMapOpacity ?? 1}
              onChange={handleOpacityChange}
            />
          </WhiteSectionGeneric>
        </Box>

        {allLegendItems?.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <WhiteSectionGeneric>
              <SectionAnnotationVisibility
                legendItems={allLegendItems}
                disabledAnnotationTemplates={
                  container.disabledAnnotationTemplates || []
                }
                spriteImage={spriteImage}
                onToggleTemplate={handleToggleTemplate}
                onToggleListing={handleToggleListing}
              />
            </WhiteSectionGeneric>
          </Box>
        )}
      </Box>
    </BoxFlexVStretch>
  );
}
