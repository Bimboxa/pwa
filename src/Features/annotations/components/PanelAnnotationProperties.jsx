import { useRef } from "react";

import { useSelector, useDispatch } from "react-redux";

import { triggerSelectionBack, setAnnotationPropertiesTab } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";
import useEntityFormTemplate from "Features/entities/hooks/useEntityFormTemplate";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import { Box, Typography, IconButton, Tabs, Tab } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionAnnotationPropertiesContent from "./SectionAnnotationPropertiesContent";
import FormEntity from "Features/entities/components/FormEntity";
import SectionEntityAnnotations from "Features/entities/components/SectionEntityAnnotations";

const tabs = [
  { id: "PROPERTIES", label: "Propriété" },
  { id: "ENTITY", label: "Objet" },
];

export default function PanelAnnotationProperties() {
  const dispatch = useDispatch();
  const containerRef = useRef();

  // data

  const annotation = useSelectedAnnotation();
  const tab = useSelector((s) => s.selection.annotationPropertiesTab);
  const { value: entity } = useSelectedEntity({ withImages: true, withAnnotations: true });
  const template = useEntityFormTemplate();
  const updateEntity = useUpdateEntity();

  // helpers

  const label = annotation?.label || "Annotation";
  const idx = tabs.map(({ id }) => id).indexOf(tab);

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

      <Box sx={{
        display: "flex", alignItems: "center",
        p: 0.5,
        pl: 1,
      }}>
        <IconButton onClick={() => dispatch(triggerSelectionBack())}>
          <Back />
        </IconButton>

        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Annotation
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {label}
          </Typography>
        </Box>
      </Box>

      <Tabs value={idx} onChange={handleTabChange}>
        {tabs.map(({ id, label }) => (
          <Tab key={id} label={label} id={id} />
        ))}
      </Tabs>

      <BoxFlexVStretch sx={{ overflowY: "auto" }}>

        {tab === "PROPERTIES" && (
          <SectionAnnotationPropertiesContent annotation={annotation} />
        )}

        {tab === "ENTITY" && (
          entity ? (
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
          )
        )}

      </BoxFlexVStretch>

    </BoxFlexVStretch>
  );
}
