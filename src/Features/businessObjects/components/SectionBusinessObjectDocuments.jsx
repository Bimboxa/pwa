import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerRelsBusinessObjectResourceUpdate } from "../businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import {
  InsertDriveFileOutlined,
  LinkOff,
  PictureAsPdf,
} from "@mui/icons-material";

import db from "App/db/db";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import useRelsBusinessObjectResource from "../hooks/useRelsBusinessObjectResource";
import sortDocumentRels from "../utils/sortDocumentRels";
import isWholeResourceRel from "../utils/isWholeResourceRel";
import resolveResourceOfRelService from "Features/resources/services/resolveResourceOfRelService";
import useOpenResourceRel from "Features/pdfEditor/hooks/useOpenResourceRel";

// White card of the business object properties panel listing its links to
// resources (db.relsBusinessObjectResource): highlighted zones of PDF
// documents and whole resources. A row click opens a PDF in the PDF editor
// layer (at the page and passage, for a zone), any other file in the
// RESOURCES panel (useOpenResourceRel).
export default function SectionBusinessObjectDocuments({ businessObjectId }) {
  const dispatch = useDispatch();
  const openResourceRel = useOpenResourceRel();

  // strings

  const titleS = "Documents";
  const emptyS =
    "Aucun document lié. Dans Ressources, liez une ressource ou surlignez un texte d'un document.";
  const pageS = "p.";
  const missingS = "Document introuvable";
  const unlinkPassageS = "Délier ce passage";
  const unlinkResourceS = "Délier ce document";

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
    openResourceRel(rel, resource);
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
              const isWhole = isWholeResourceRel(rel);
              const Icon = isWhole ? InsertDriveFileOutlined : PictureAsPdf;
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
                  <Icon sx={{ fontSize: 18, mr: 1, color: "text.secondary" }} />
                  <ListItemText
                    primary={rel.text ? `« ${rel.text} »` : name}
                    secondary={
                      isWhole
                        ? isMissing
                          ? missingS
                          : null
                        : `${
                            isMissing ? `${missingS} · ` : ""
                          }${name} · ${pageS} ${rel.pageNumber}`
                    }
                    slotProps={{
                      primary: { variant: "body2", noWrap: true },
                      secondary: { variant: "caption", noWrap: true },
                    }}
                  />
                  <IconButton
                    className="business-object-unlink"
                    size="small"
                    onClick={(e) => handleUnlink(e, rel)}
                    title={isWhole ? unlinkResourceS : unlinkPassageS}
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
