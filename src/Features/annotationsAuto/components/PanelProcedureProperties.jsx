import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  setSelectedItem,
  clearSelection,
  selectSelectedItems,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingProcedureSourceIds from "../hooks/useListingProcedureSourceIds";

import hasProcedureParams from "../utils/hasProcedureParams";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import SectionProcedureParams from "./SectionProcedureParams";
import ProcedureActionButtons from "./ProcedureActionButtons";

function ListTemplates({ templates, emptyLabel }) {
  if (templates.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyLabel}
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
      {templates.map((template) => (
        <Box
          key={template.id}
          sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
        >
          <Box
            sx={{
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AnnotationTemplateIcon template={template} size={16} />
          </Box>
          <Typography variant="body2" noWrap>
            {template.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Right-panel properties of an automated procedure (selection item of type
 * PROCEDURE, see getProcedureSelectedItem): description, the annotation
 * templates of the listing it starts from (sourceMappingCategories) and the
 * ones it creates (createdMappingCategories), its parameters and the launch
 * buttons. Linked to a listing, the back arrow selects that listing.
 */
export default function PanelProcedureProperties() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Procédure auto";
  const backS = "Retour";
  const descriptionS = "Description";
  const sourcesS = "Annotations sources";
  const createdS = "Annotations créées";
  const paramsS = "Paramètres";
  const launchS = "Lancer";
  const noTemplateS = "Aucun modèle correspondant dans la liste";

  // data

  const selectedItem = useSelector(selectSelectedItems)[0];
  const procedureKey = selectedItem?.procedureKey;
  const listingId = selectedItem?.listingId ?? null;

  const appConfig = useAppConfig();
  const procedure = (appConfig?.automatedAnnotationsProcedures ?? []).find(
    (p) => p.key === procedureKey
  );

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  // Procedures create annotations with the templates of the listing's own
  // templates — never resolve a category from another listing.
  const listingTemplates = useLiveQuery(async () => {
    if (!listingId) return [];
    const templates = await db.annotationTemplates
      .where("listingId")
      .equals(listingId)
      .toArray();
    return templates.filter((t) => !t.deletedAt);
  }, [listingId]);

  const getSourceAnnotationIds = useListingProcedureSourceIds({
    listingId,
    baseMapId,
    enabled: Boolean(procedure && listingId),
  });

  // helpers

  function getTemplatesByCategories(categories) {
    return (listingTemplates ?? []).filter((t) =>
      (categories ?? []).some((c) => t.mappingCategories?.includes(c))
    );
  }

  const sourceCategories = procedure?.sourceMappingCategories ?? [];
  const createdCategories = procedure?.createdMappingCategories ?? [];
  const sourceTemplates = getTemplatesByCategories(sourceCategories);
  const createdTemplates = getTemplatesByCategories(createdCategories);
  const sourceAnnotationIds = procedure
    ? getSourceAnnotationIds(procedure)
    : [];

  // handlers

  function handleBack() {
    if (listingId) {
      dispatch(setSelectedItem({ id: listingId, type: "LISTING" }));
    } else {
      dispatch(clearSelection());
    }
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  // render

  if (!procedure) return null;

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <Tooltip title={backS}>
          <IconButton size="small" onClick={handleBack}>
            <ArrowBack fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ ml: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{
              fontStyle: "italic",
              fontSize: (theme) => theme.typography.caption.fontSize,
            }}
          >
            {captionS}
          </Typography>
          <Typography noWrap variant="body2" sx={{ fontWeight: "bold" }}>
            {procedure.label}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        {procedure.description && (
          <WhiteSectionGeneric>
            <WhiteSectionTitle sx={{ mb: 0.5 }}>
              {descriptionS}
            </WhiteSectionTitle>
            <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
              {procedure.description}
            </Typography>
          </WhiteSectionGeneric>
        )}

        {listingId && sourceCategories.length > 0 && (
          <WhiteSectionGeneric>
            <WhiteSectionTitle sx={{ mb: 0.5 }}>{sourcesS}</WhiteSectionTitle>
            <ListTemplates
              templates={sourceTemplates}
              emptyLabel={noTemplateS}
            />
          </WhiteSectionGeneric>
        )}

        {listingId && createdCategories.length > 0 && (
          <WhiteSectionGeneric>
            <WhiteSectionTitle sx={{ mb: 0.5 }}>{createdS}</WhiteSectionTitle>
            <ListTemplates
              templates={createdTemplates}
              emptyLabel={noTemplateS}
            />
          </WhiteSectionGeneric>
        )}

        {hasProcedureParams(procedure) && (
          <WhiteSectionGeneric>
            <WhiteSectionTitle sx={{ mb: 0.5 }}>{paramsS}</WhiteSectionTitle>
            <SectionProcedureParams procedure={procedure} dense />
          </WhiteSectionGeneric>
        )}

        {listingId && (
          <WhiteSectionGeneric>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <WhiteSectionTitle>{launchS}</WhiteSectionTitle>
              <ProcedureActionButtons
                procedureKey={procedure.key}
                baseMapId={baseMapId}
                sourceAnnotationIds={sourceAnnotationIds}
                disabled={sourceAnnotationIds.length === 0}
              />
            </Box>
          </WhiteSectionGeneric>
        )}
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
