import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import hasProcedureParams from "../utils/hasProcedureParams";

import { Box, Typography } from "@mui/material";

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
 * Sections describing an automated procedure linked to a listing: description,
 * the annotation templates it starts from (sourceMappingCategories) with the
 * number of source annotations concerned on the base map, the templates it
 * creates (createdMappingCategories), its parameters and the launch buttons.
 * Shared by the right-panel properties (PanelProcedureProperties) and the
 * launch dialog of the "Dessin auto" section (DialogProcedureLaunch).
 *
 * `sourceAnnotationIds`: ids of the source annotations of the run on the base
 * map (useListingProcedureSourceIds), also the reset scope of the buttons.
 */
export default function SectionsProcedureProperties({
  procedure,
  listingId,
  baseMapId,
  sourceAnnotationIds,
  // Launch section: hidden where the host shows its own buttons.
  showLaunch = true,
}) {
  // strings

  const descriptionS = "Description";
  const sourcesS = "Annotations sources";
  const createdS = "Annotations créées";
  const paramsS = "Paramètres";
  const launchS = "Lancer";
  const noTemplateS = "Aucun modèle correspondant dans la liste";

  // data

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
  const sourceIds = sourceAnnotationIds ?? [];
  const sourceCount = sourceIds.length;
  const sourceCountS =
    sourceCount === 0
      ? "Aucune annotation source sur ce fond de plan"
      : `${sourceCount} annotation${sourceCount > 1 ? "s" : ""} source${
          sourceCount > 1 ? "s" : ""
        } sur ce fond de plan`;

  // render

  if (!procedure) return null;

  return (
    <>
      {procedure.description && (
        <WhiteSectionGeneric>
          <WhiteSectionTitle sx={{ mb: 0.5 }}>{descriptionS}</WhiteSectionTitle>
          <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
            {procedure.description}
          </Typography>
        </WhiteSectionGeneric>
      )}

      {listingId && (
        <WhiteSectionGeneric>
          <WhiteSectionTitle sx={{ mb: 0.5 }}>{sourcesS}</WhiteSectionTitle>
          {sourceCategories.length > 0 && (
            <ListTemplates
              templates={sourceTemplates}
              emptyLabel={noTemplateS}
            />
          )}
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: sourceCategories.length > 0 ? 0.75 : 0,
              fontWeight: 600,
              color: sourceCount > 0 ? "secondary.main" : "text.secondary",
            }}
          >
            {sourceCountS}
          </Typography>
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

      {listingId && showLaunch && (
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
              sourceAnnotationIds={sourceIds}
              disabled={sourceCount === 0}
            />
          </Box>
        </WhiteSectionGeneric>
      )}
    </>
  );
}
