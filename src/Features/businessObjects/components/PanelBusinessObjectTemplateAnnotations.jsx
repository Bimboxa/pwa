import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArrowBack as Back, LinkOff } from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

import getAnnotationMainQtyLabel from "Features/annotations/utils/getAnnotationMainQtyLabel";

// Sub-panel of the business object properties ("Quantités" tab): the
// annotations of ONE annotation template linked to the object, with their
// own quantity and unlink buttons. The back button returns to the
// quantities recap.
// rows: [{annotation, rel}] of the template.
export default function PanelBusinessObjectTemplateAnnotations({
  businessObject,
  template,
  rows,
  baseMapNameById,
  spriteImage,
  onBack,
  onUnlink,
}) {
  // strings

  const backS = "Retour aux quantités";
  const noTemplateS = "Sans modèle";
  const unlinkS = "Délier cette annotation";
  const emptyS = "Aucune annotation liée pour ce modèle";
  const countS = `${rows.length} annotation${rows.length > 1 ? "s" : ""}`;

  // render

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

      {/* annotations */}
      <Box sx={{ overflowY: "auto", flex: 1 }}>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {emptyS}
          </Typography>
        ) : (
          <List dense disablePadding>
            {rows.map(({ annotation, rel }) => (
              <ListItem
                key={annotation.id}
                sx={{
                  py: 0.25,
                  "&:hover .business-object-unlink": {
                    visibility: "visible",
                  },
                }}
              >
                <ListItemText
                  primary={annotation.label ?? template?.label ?? "Annotation"}
                  secondary={baseMapNameById[annotation.baseMapId] || null}
                  slotProps={{
                    primary: { variant: "body2", noWrap: true },
                    secondary: { variant: "caption", noWrap: true },
                  }}
                />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 1, whiteSpace: "nowrap" }}
                >
                  {getAnnotationMainQtyLabel(annotation, annotation.qties)}
                </Typography>
                <Tooltip title={unlinkS} placement="top" arrow>
                  <IconButton
                    className="business-object-unlink"
                    size="small"
                    onClick={() => onUnlink(rel)}
                    sx={{ ml: 0.5, visibility: "hidden" }}
                  >
                    <LinkOff sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
