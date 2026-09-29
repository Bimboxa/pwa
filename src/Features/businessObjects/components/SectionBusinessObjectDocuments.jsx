import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerRelsBusinessObjectResourceUpdate } from "../businessObjectsSlice";
import { openResourceAtPage } from "Features/resources/resourcesSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { LinkOff, PictureAsPdf } from "@mui/icons-material";

import db from "App/db/db";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import useRelsBusinessObjectResource from "../hooks/useRelsBusinessObjectResource";
import sortDocumentRels from "../utils/sortDocumentRels";
import resolveResourceOfRelService from "Features/resources/services/resolveResourceOfRelService";

// White card of the business object properties panel listing its links to
// highlighted zones of PDF documents (db.relsBusinessObjectResource). A row
// click opens the document at the page in the RESOURCES panel.
export default function SectionBusinessObjectDocuments({ businessObjectId }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Documents";
  const emptyS =
    "Aucun passage lié. Ouvrez un document dans Ressources et surlignez un texte.";
  const pageS = "p.";
  const missingS = "Document introuvable";
  const unlinkS = "Délier ce passage";

  // data

  const { value: rels } = useRelsBusinessObjectResource({ businessObjectId });

  const relIdsKey = (rels ?? []).map((r) => r.id).join(",");
  const resourceByRelId = useLiveQuery(async () => {
    const byRelId = {};
    for (const rel of rels ?? []) {
      byRelId[rel.id] = await resolveResourceOfRelService(rel);
    }
    return byRelId;
  }, [relIdsKey]);

  // helpers

  const rows = sortDocumentRels(rels);

  // handlers

  function handleOpen(rel, resource) {
    if (!resource) return;
    dispatch(
      openResourceAtPage({
        resourceId: resource.id,
        pageNumber: rel.pageNumber,
        highlightId: rel.id,
      })
    );
    dispatch(setSelectedMenuItemKey("RESOURCES"));
  }

  async function handleUnlink(e, rel) {
    e.stopPropagation();
    try {
      await db.relsBusinessObjectResource.delete(rel.id);
      dispatch(triggerRelsBusinessObjectResourceUpdate());
    } catch (error) {
      console.error("[SectionBusinessObjectDocuments] unlink", error);
      dispatch(
        setToaster({ message: error?.message ?? `${error}`, isError: true })
      );
    }
  }

  // render

  return (
    <Box sx={{ p: 1.5 }}>
      <WhiteSectionGeneric>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {titleS}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {rows.length}
          </Typography>
        </Box>

        {rows.length === 0 ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            {emptyS}
          </Typography>
        ) : (
          <List dense disablePadding sx={{ mt: 0.5 }}>
            {rows.map((rel) => {
              const resource = resourceByRelId?.[rel.id];
              const isMissing = resourceByRelId && !resource;
              const name = resource?.name ?? rel.resourceName ?? "";
              return (
                <ListItemButton
                  key={rel.id}
                  disableGutters
                  onClick={() => handleOpen(rel, resource)}
                  sx={{
                    py: 0.25,
                    px: 0.5,
                    borderRadius: 1,
                    opacity: isMissing ? 0.5 : 1,
                    "&:hover .business-object-unlink": {
                      visibility: "visible",
                    },
                  }}
                >
                  <PictureAsPdf
                    sx={{ fontSize: 18, mr: 1, color: "text.secondary" }}
                  />
                  <ListItemText
                    primary={rel.text ? `« ${rel.text} »` : name}
                    secondary={`${
                      isMissing ? `${missingS} · ` : ""
                    }${name} · ${pageS} ${rel.pageNumber}`}
                    slotProps={{
                      primary: { variant: "body2", noWrap: true },
                      secondary: { variant: "caption", noWrap: true },
                    }}
                  />
                  <IconButton
                    className="business-object-unlink"
                    size="small"
                    onClick={(e) => handleUnlink(e, rel)}
                    title={unlinkS}
                    sx={{ ml: 0.5, visibility: "hidden" }}
                  >
                    <LinkOff sx={{ fontSize: 16 }} />
                  </IconButton>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </WhiteSectionGeneric>
    </Box>
  );
}
