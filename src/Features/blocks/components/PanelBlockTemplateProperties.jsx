import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItems,
  setShowAnnotationsProperties,
  triggerSelectionBack,
} from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, Button, Chip, IconButton, Typography } from "@mui/material";
import {
  AddLocationAltOutlined,
  ArrowBack as Back,
  OpenInNew,
  SelectAll,
  WidgetsOutlined,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import IconButtonMoreActionsAnnotationTemplate from "Features/annotations/components/IconButtonMoreActionsAnnotationTemplate";
import AnnotationMeasurements from "Features/annotations/components/AnnotationMeasurements";
import FieldAnnotationTemplateLegend from "Features/annotations/components/FieldAnnotationTemplateLegend";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";
import buildAnnotationSelectionItem from "Features/annotations/utils/buildAnnotationSelectionItem";

import useBlocks from "../hooks/useBlocks";
import useBlocksBaseMaps from "../hooks/useBlocksBaseMaps";
import useBlockMemberBaseMaps from "../hooks/useBlockMemberBaseMaps";
import useBlockDefinitionInStore from "../hooks/useBlockDefinitionInStore";
import useOpenBlocksBaseMap from "../hooks/useOpenBlocksBaseMap";
import usePlaceBlockInstance from "../hooks/usePlaceBlockInstance";

// Properties panel of a BLOCK annotation template (selected template row):
// dedicated to the block it points to — label, instances shown (select
// all), what one instance counts for, the blocks base maps where the block
// is drawn (click = open) and the placement of new instances.
// `instances`: the BLOCK_INSTANCE annotations of the template currently
// displayed (same perimeter as the template rows).
export default function PanelBlockTemplateProperties({
  annotationTemplate,
  instances = [],
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Bloc";
  const labelS = "Libellé";
  const instancesS = "Instances affichées";
  const selectAllS = "Tout sélectionner";
  const perInstanceS = "Quantités d'une instance";
  const baseMapsS = "Fonds de plan du bloc";
  const noBaseMapS =
    "Ce bloc n'a pas encore d'annotation. Ouvrez son fond de plan de blocs, dessinez-y ses annotations puis liez-les au bloc.";
  const openS = "Ouvrir le fond de plan de blocs";
  const placeS = "Insérer des instances";
  const missingS = "Le bloc de ce modèle est introuvable.";
  const emptyBlockS = "Ce bloc n'a pas encore d'annotation à insérer.";
  const onBlocksBaseMapS =
    "Ouvrez un fond de plan du projet pour y positionner le bloc.";

  // data

  const blocks = useBlocks();
  const blocksBaseMaps = useBlocksBaseMaps();
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();
  const openBlocksBaseMap = useOpenBlocksBaseMap();
  const placeBlockInstance = usePlaceBlockInstance();

  // helpers

  const block = blocks?.find((b) => b.id === annotationTemplate?.blockId);
  const blocksLoaded = blocks !== undefined;
  const memberBaseMaps = useBlockMemberBaseMaps(block);
  const definition = useBlockDefinitionInStore(block?.id);
  const totals = definition?.totals;
  const count = instances.length;
  const isOnBlocksBaseMap = (blocksBaseMaps ?? []).some(
    (b) => b.id === selectedBaseMapId
  );

  // handlers

  function handleLabelChange(label) {
    if (!annotationTemplate || !label?.trim()) return;
    updateAnnotationTemplate({ ...annotationTemplate, label });
  }

  // Legend settings: same fields as a regular template (« Avancé » tab).
  function handleTemplateFieldChange(field, value) {
    if (!annotationTemplate) return;
    updateAnnotationTemplate({ ...annotationTemplate, [field]: value });
  }

  function handleSelectAll() {
    const items = instances.map(buildAnnotationSelectionItem).filter(Boolean);
    dispatch(setSelectedItems(items));
    if (items.length === 1) dispatch(setShowAnnotationsProperties(true));
  }

  function handleOpenBaseMap(baseMapId) {
    if (!block) return;
    openBlocksBaseMap({ block, baseMapId });
  }

  function handlePlace() {
    if (!block) return;
    if (isOnBlocksBaseMap) {
      dispatch(setToaster({ message: onBlocksBaseMapS, severity: "info" }));
      return;
    }
    if (!block.membersCount) {
      dispatch(setToaster({ message: emptyBlockS, severity: "info" }));
      return;
    }
    placeBlockInstance(block, { annotationTemplate });
  }

  // render

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
        <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          <IconButton onClick={() => dispatch(triggerSelectionBack())}>
            <Back />
          </IconButton>
          <WidgetsOutlined fontSize="small" color="primary" sx={{ ml: 1 }} />
          <Box sx={{ ml: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{
                fontStyle: "italic",
                fontSize: (theme) => theme.typography.caption.fontSize,
              }}
            >
              {titleS}
            </Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: "bold" }}>
              {annotationTemplate?.label ?? "-"}
            </Typography>
          </Box>
        </Box>
        <IconButtonMoreActionsAnnotationTemplate
          annotationTemplate={annotationTemplate}
        />
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1 }}>
          <FieldTextV2
            label={labelS}
            value={annotationTemplate?.label ?? ""}
            onChange={handleLabelChange}
            options={{
              fullWidth: true,
              placeholder: labelS,
              showAsField: true,
              changeOnBlur: true,
            }}
          />

          {blocksLoaded && !block && (
            <WhiteSectionGeneric>
              <Typography variant="body2" color="error">
                {missingS}
              </Typography>
            </WhiteSectionGeneric>
          )}

          {/* instances shown + what one instance counts for */}
          <WhiteSectionGeneric>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
                {instancesS}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                {count}
              </Typography>
              <IconButton
                size="small"
                title={selectAllS}
                disabled={count === 0}
                onClick={handleSelectAll}
              >
                <SelectAll fontSize="small" />
              </IconButton>
            </Box>
            {(totals?.surface > 0 || totals?.length > 0) && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mt: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flex: 1 }}
                >
                  {perInstanceS}
                </Typography>
                <AnnotationMeasurements
                  surface={totals.surface}
                  length={totals.length}
                />
              </Box>
            )}
          </WhiteSectionGeneric>

          {/* blocks base maps where the block is drawn */}
          {block && (
            <WhiteSectionGeneric>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                {baseMapsS}
              </Typography>
              {(memberBaseMaps ?? []).length > 0 ? (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                  {memberBaseMaps.map((baseMap) => {
                    const selected = baseMap.id === selectedBaseMapId;
                    return (
                      <Chip
                        key={baseMap.id}
                        size="small"
                        icon={
                          <OpenInNew sx={{ fontSize: "14px !important" }} />
                        }
                        label={`${baseMap.name} · ${baseMap.membersCount}`}
                        color={selected ? "primary" : "default"}
                        variant={selected ? "filled" : "outlined"}
                        onClick={() => handleOpenBaseMap(baseMap.id)}
                      />
                    );
                  })}
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 0.75,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {noBaseMapS}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<OpenInNew />}
                    onClick={() => handleOpenBaseMap(null)}
                    sx={{ textTransform: "none" }}
                  >
                    {openS}
                  </Button>
                </Box>
              )}
            </WhiteSectionGeneric>
          )}

          {block && (
            <Button
              variant="contained"
              startIcon={<AddLocationAltOutlined />}
              onClick={handlePlace}
              sx={{ textTransform: "none", alignSelf: "flex-start" }}
            >
              {placeS}
            </Button>
          )}

          <FieldAnnotationTemplateLegend
            labelLegend={annotationTemplate?.labelLegend}
            hiddenInLegend={annotationTemplate?.hiddenInLegend}
            groupLabel={annotationTemplate?.groupLabel}
            onLabelLegendChange={(v) =>
              handleTemplateFieldChange("labelLegend", v)
            }
            onHiddenInLegendChange={(v) =>
              handleTemplateFieldChange("hiddenInLegend", v)
            }
            onGroupLabelChange={(v) =>
              handleTemplateFieldChange("groupLabel", v)
            }
          />
        </Box>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
