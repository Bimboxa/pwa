import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { openResourceAtPage } from "Features/resources/resourcesSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { ArrowForward, PictureAsPdfOutlined } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import { resolveDetailResource } from "Features/baseMaps/services/detailBaseMapUtils";
import duplicateResourceToProject from "Features/resources/services/duplicateResourceToProjectService";
import getResourceVisibility from "Features/resources/utils/getResourceVisibility";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import db from "App/db/db";

// "Source : <pdf>" row of the base map panel, for base maps cut from a PDF
// kept as a resource. The arrow opens the RESOURCES panel on that PDF at
// the source page. Renders nothing for non-PDF base maps.
export default function SectionBaseMapSource({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const sourceS = "Source";
  const openS = "Ouvrir dans les ressources";
  const missingS = "Fichier absent : rechargez-le depuis les ressources";

  // data

  const createdFrom = baseMap?.createdFrom;
  const isPdf = createdFrom?.type === "PDF_PAGE" && Boolean(createdFrom.resourceId);
  const projectId = baseMap?.projectId;

  const resource = useLiveQuery(async () => {
    if (!isPdf) return null;
    return resolveDetailResource({ createdFrom, projectId });
  }, [isPdf, createdFrom?.resourceId, createdFrom?.pdfFileName, projectId]);

  // helpers

  const name = resource?.name ?? createdFrom?.pdfFileName ?? "PDF";
  const sourcePage = createdFrom?.sourcePageNumber ?? createdFrom?.pageNumber;
  const pageS =
    resource?.kind === "PDF_SOURCE" && sourcePage ? ` · p.${sourcePage}` : "";
  const fileMissing = resource === null;

  // handlers

  // The source must live in the base map's project (the RESOURCES panel
  // lists a project's rows). Base maps created before the dedup was
  // project-scoped may point at another project's resource: heal them by
  // copying the resource into the project and re-pointing createdFrom.
  async function handleOpen() {
    if (!resource) return;
    let target = resource;
    const isGlobal = getResourceVisibility(resource) === "GLOBAL";
    if (projectId && resource.projectId !== projectId && !isGlobal) {
      const copy = await duplicateResourceToProject(resource, { projectId });
      if (copy) {
        target = copy;
        await db.baseMaps.update(baseMap.id, {
          createdFrom: { ...createdFrom, resourceId: copy.id, pdfFileName: copy.name },
        });
        dispatch(triggerEntitiesTableUpdate("baseMaps"));
      }
    }
    dispatch(
      openResourceAtPage({
        resourceId: target.id,
        pageNumber: createdFrom?.pageNumber ?? 1,
        rotation: createdFrom?.rotation,
      })
    );
    dispatch(setSelectedMenuItemKey("RESOURCES"));
  }

  // render

  if (!isPdf) return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <PictureAsPdfOutlined fontSize="small" color="action" />
        <Typography variant="body2" sx={{ fontWeight: "bold", flexShrink: 0 }}>
          {sourceS}
        </Typography>
        <Tooltip title={fileMissing ? missingS : name}>
          <Typography
            variant="body2"
            color={fileMissing ? "text.disabled" : "text.secondary"}
            noWrap
            sx={{ flex: 1, minWidth: 0 }}
          >
            {name}
            {pageS}
          </Typography>
        </Tooltip>
        <Tooltip title={openS}>
          <span>
            <IconButton size="small" onClick={handleOpen} disabled={!resource}>
              <ArrowForward fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </WhiteSectionGeneric>
  );
}
