import { useRef } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setAnnotationPropertiesTab } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useSelectedAnnotationPart from "Features/annotations/hooks/useSelectedAnnotationPart";

import { Box, Typography, Tabs, Tab } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionAnnotationPropertiesContent from "./SectionAnnotationPropertiesContent";
import SectionAnnotationPartPropertiesContent from "./SectionAnnotationPartPropertiesContent";
import SectionMultiPartProperties from "./SectionMultiPartProperties";
import SectionAnnotationZones from "Features/zonings/components/SectionAnnotationZones";
import SectionAnnotationPhotoPlan from "Features/photoPlans/components/SectionAnnotationPhotoPlan";
import SectionAnnotationFolioContent from "Features/detailFolio/components/SectionAnnotationFolioContent";

// The label options ("Etiquette") are no longer a tab here: clicking the
// label chip selects it (ANNOTATION_LABEL) and opens its own panel
// (PanelAnnotationLabelProperties).
function getTabs(annotation) {
  return [
    { id: "PROPERTIES", label: "Propriété" },
    ...(annotation?.type === "DETAIL" ? [{ id: "FOLIO", label: "Folio" }] : []),
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

  // helpers

  const tabs = getTabs(annotation);
  const tabIds = tabs.map(({ id }) => id);
  // Selected tab may not exist for this annotation (e.g. "FOLIO" then a
  // POLYGON gets selected, or a stale "LABEL") — fall back to the first tab.
  const effectiveTab = tabIds.includes(tab) ? tab : "PROPERTIES";
  const idx = tabIds.indexOf(effectiveTab);

  // handlers

  function handleTabChange(e, newIdx) {
    dispatch(setAnnotationPropertiesTab(tabs[newIdx]?.id));
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
      {/* A single tab is no navigation: hide the bar. */}
      {!hasPart && tabs.length > 1 && (
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

        {!hasPart && effectiveTab === "FOLIO" && (
          <SectionAnnotationFolioContent annotation={annotation} />
        )}

      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
