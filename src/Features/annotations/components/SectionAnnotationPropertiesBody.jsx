import { useRef } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setAnnotationPropertiesTab } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useSelectedAnnotationPart from "Features/annotations/hooks/useSelectedAnnotationPart";
import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";
import useEntityFormTemplate from "Features/entities/hooks/useEntityFormTemplate";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import { Box, Typography, Tabs, Tab } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionAnnotationPropertiesContent from "./SectionAnnotationPropertiesContent";
import SectionAnnotationLabelContent from "./SectionAnnotationLabelContent";
import SectionAnnotationPartPropertiesContent from "./SectionAnnotationPartPropertiesContent";
import SectionMultiPartProperties from "./SectionMultiPartProperties";
import FormEntity from "Features/entities/components/FormEntity";
import SectionEntityAnnotations from "Features/entities/components/SectionEntityAnnotations";
import SectionAnnotationZones from "Features/zonings/components/SectionAnnotationZones";
import SectionAnnotationPhotoPlan from "Features/photoPlans/components/SectionAnnotationPhotoPlan";
import SectionAnnotationFolioContent from "Features/detailFolio/components/SectionAnnotationFolioContent";

// Types without a draggable sub-label (no labelDelta model) — no Etiquette tab.
const TYPES_WITHOUT_LABEL = ["COTE", "RULER", "TEXT", "LABEL", "DETAIL"];

function getTabs(annotation) {
  const showLabelTab =
    annotation &&
    !TYPES_WITHOUT_LABEL.includes(annotation.type) &&
    !annotation.isMeshCell &&
    !annotation.isBaseMapAnnotation;

  return [
    { id: "PROPERTIES", label: "Propriété" },
    ...(showLabelTab ? [{ id: "LABEL", label: "Etiquette" }] : []),
    ...(annotation?.type === "DETAIL" ? [{ id: "FOLIO", label: "Folio" }] : []),
    { id: "ENTITY", label: "Objet" },
  ];
}

// ---------------------------------------------------------------------------
// SectionAnnotationPropertiesBody — tabs + content of one annotation's
// properties. Selection-driven by default (right panel,
// PanelAnnotationProperties); the Dessin left panel (PanelAnnotationDetail)
// passes the annotation as a prop instead — the panel must not touch the
// selection just to display the content.
// ---------------------------------------------------------------------------

export default function SectionAnnotationPropertiesBody({
  annotation: annotationProp,
  // Forwarded to the Propriété tab: the hosting panel renders the overview
  // card and the label field above the tabs itself.
  hideOverview,
}) {
  const dispatch = useDispatch();
  const containerRef = useRef();

  // data

  const selectedAnnotation = useSelectedAnnotation();
  const annotation = annotationProp ?? selectedAnnotation;
  const part = useSelectedAnnotationPart();
  // Parts come from the map selection — in prop mode they only apply when
  // the selection targets the displayed annotation.
  const partApplies =
    !annotationProp || selectedAnnotation?.id === annotationProp.id;
  const hasPart = partApplies && part && part.kind && part.kind !== "NONE";
  const tab = useSelector((s) => s.selection.annotationPropertiesTab);
  const { value: entity } = useSelectedEntity({
    withImages: true,
    withAnnotations: true,
    // Prop mode: resolve the entity from the annotation itself (the
    // selection may point elsewhere or be empty).
    ...(annotationProp
      ? {
          entityId: annotationProp.entityId,
          fromListingId: annotationProp.listingId,
        }
      : {}),
  });
  const template = useEntityFormTemplate();
  const updateEntity = useUpdateEntity();

  // helpers

  const tabs = getTabs(annotation);
  const tabIds = tabs.map(({ id }) => id);
  // Selected tab may not exist for this annotation (e.g. "LABEL" then a COTE
  // gets selected) — fall back to the first tab.
  const effectiveTab = tabIds.includes(tab) ? tab : "PROPERTIES";
  const idx = tabIds.indexOf(effectiveTab);

  // handlers

  function handleTabChange(e, newIdx) {
    dispatch(setAnnotationPropertiesTab(tabs[newIdx]?.id));
  }

  async function handleEntityChange(entity) {
    await updateEntity(entity?.id, entity);
  }

  // render - no selection

  if (!annotation) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aucune annotation sélectionnée
        </Typography>
      </Box>
    );
  }

  // render

  return (
    <BoxFlexVStretch ref={containerRef}>
      {!hasPart && (
        <Tabs value={idx} onChange={handleTabChange}>
          {tabs.map(({ id, label }) => (
            <Tab key={id} label={label} id={id} />
          ))}
        </Tabs>
      )}

      <BoxFlexVStretch sx={{ overflowY: "auto" }}>
        {hasPart && part.kind === "MIXED" && (
          <SectionMultiPartProperties part={part} />
        )}

        {hasPart && part.kind !== "MIXED" && (
          <SectionAnnotationPartPropertiesContent
            annotation={annotation}
            part={part}
          />
        )}

        {!hasPart && effectiveTab === "PROPERTIES" && (
          <>
            <SectionAnnotationPropertiesContent
              annotation={annotation}
              hideOverview={hideOverview}
            />
            {/* Zone links (zonings module) — not for the zone delimitation
                polygons themselves. */}
            {!annotation?.isZoneAnnotation && (
              <SectionAnnotationZones annotation={annotation} />
            )}
            {/* Plan photo (photoPlans) — POLYGON on a photo baseMap only,
                self-hiding otherwise. */}
            <SectionAnnotationPhotoPlan annotation={annotation} />
          </>
        )}

        {!hasPart && effectiveTab === "LABEL" && (
          <SectionAnnotationLabelContent annotation={annotation} />
        )}

        {!hasPart && effectiveTab === "FOLIO" && (
          <SectionAnnotationFolioContent annotation={annotation} />
        )}

        {!hasPart &&
          effectiveTab === "ENTITY" &&
          (entity ? (
            <>
              <FormEntity
                template={template}
                entity={entity}
                onEntityChange={handleEntityChange}
                sectionContainerEl={containerRef?.current}
              />
              {entity?.annotations?.length > 0 && (
                <Box sx={{ py: 1 }}>
                  <SectionEntityAnnotations
                    entity={entity}
                    selectedAnnotationId={annotation?.id}
                  />
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Aucun objet associé
              </Typography>
            </Box>
          ))}
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
