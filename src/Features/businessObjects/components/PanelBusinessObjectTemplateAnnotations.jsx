import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddLink, ArrowBack as Back, LinkOff } from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

import getAnnotationMainQtyLabel from "Features/annotations/utils/getAnnotationMainQtyLabel";

// Sub-panel of the business object properties ("Quantités" tab): the
// annotations of ONE annotation template feeding the object, with their
// own quantity and unlink buttons. The back button returns to the
// quantities recap.
// rows: [{annotation, rel | null}] of the template (rel null = fed by the
// template link only). isLinkedByTemplate: the template is linked as a
// whole — every annotation of the template counts, so the per-row action is
// an EXCLUSION from the template link (onExclude) instead of a rel delete
// (which would not change the count). excludedRows: [{annotation}] of the
// template already excluded, listed apart (dimmed) with a re-include action
// (onReinclude).
export default function PanelBusinessObjectTemplateAnnotations({
  businessObject,
  template,
  rows,
  excludedRows = [],
  isLinkedByTemplate,
  baseMapNameById,
  spriteImage,
  onBack,
  onUnlink,
  onExclude,
  onReinclude,
}) {
  // strings

  const backS = "Retour aux quantités";
  const noTemplateS = "Sans modèle";
  const unlinkS = "Délier cette annotation";
  const excludeS = "Exclure du calcul (lien par modèle)";
  const reincludeS = "Réintégrer dans le calcul";
  const excludedS = "Exclue";
  const emptyS = "Aucune annotation liée pour ce modèle";
  const byTemplateS =
    "Lien par modèle : toutes les annotations du modèle sont liées, sauf celles exclues.";
  const countS =
    `${rows.length} annotation${rows.length > 1 ? "s" : ""}` +
    (excludedRows.length > 0
      ? ` · ${excludedRows.length} exclue${excludedRows.length > 1 ? "s" : ""}`
      : "");

  // helpers

  function renderRow({ annotation, rel, excluded }) {
    const showUnlink = !isLinkedByTemplate && rel;
    const showExclude = isLinkedByTemplate && !excluded;
    const showReinclude = isLinkedByTemplate && excluded;
    return (
      <ListItem
        key={annotation.id}
        sx={{
          py: 0.25,
          color: excluded ? "text.disabled" : "inherit",
          "&:hover .business-object-row-action": {
            visibility: "visible",
          },
        }}
      >
        <ListItemText
          primary={annotation.label ?? template?.label ?? "Annotation"}
          secondary={
            excluded
              ? [excludedS, baseMapNameById[annotation.baseMapId]]
                  .filter(Boolean)
                  .join(" · ")
              : baseMapNameById[annotation.baseMapId] || null
          }
          slotProps={{
            primary: {
              variant: "body2",
              noWrap: true,
              sx: excluded ? { textDecoration: "line-through" } : undefined,
            },
            secondary: { variant: "caption", noWrap: true },
          }}
        />
        <Typography
          variant="body2"
          color={excluded ? "text.disabled" : "text.secondary"}
          sx={{ ml: 1, whiteSpace: "nowrap" }}
        >
          {getAnnotationMainQtyLabel(annotation, annotation.qties)}
        </Typography>
        {showUnlink && (
          <Tooltip title={unlinkS} placement="top" arrow>
            <IconButton
              className="business-object-row-action"
              size="small"
              onClick={() => onUnlink(rel)}
              sx={{ ml: 0.5, visibility: "hidden" }}
            >
              <LinkOff sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
        {showExclude && (
          <Tooltip title={excludeS} placement="top" arrow>
            <IconButton
              className="business-object-row-action"
              size="small"
              onClick={() => onExclude?.(annotation)}
              sx={{ ml: 0.5, visibility: "hidden" }}
            >
              <LinkOff sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
        {showReinclude && (
          <Tooltip title={reincludeS} placement="top" arrow>
            <IconButton
              className="business-object-row-action"
              size="small"
              onClick={() => onReinclude?.(annotation)}
              sx={{ ml: 0.5, visibility: "hidden" }}
            >
              <AddLink sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </ListItem>
    );
  }

  // render

  const isEmpty = rows.length === 0 && excludedRows.length === 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1,
          pl: 0.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tooltip title={backS} placement="top" arrow>
          <IconButton onClick={onBack}>
            <Back />
          </IconButton>
        </Tooltip>
        <AnnotationTemplateIcon
          template={template}
          size={20}
          spriteImage={spriteImage}
        />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {businessObject.label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
            {template?.label ?? noTemplateS}
          </Typography>
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ pr: 1, whiteSpace: "nowrap" }}
        >
          {countS}
        </Typography>
      </Box>

      {isLinkedByTemplate && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", px: 2, py: 0.75 }}
        >
          {byTemplateS}
        </Typography>
      )}

      {/* annotations: the counted ones, then the excluded ones */}
      <Box sx={{ overflowY: "auto", flex: 1 }}>
        {isEmpty ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {emptyS}
          </Typography>
        ) : (
          <List dense disablePadding>
            {rows.map((row) => renderRow({ ...row, excluded: false }))}
            {excludedRows.map((row) => renderRow({ ...row, excluded: true }))}
          </List>
        )}
      </Box>
    </Box>
  );
}
