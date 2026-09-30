import {
  Box,
  List,
  ListItemButton,
  ListSubheader,
  Paper,
  Popper,
  Typography,
} from "@mui/material";

import getBusinessObjectCodeLabel from "Features/businessObjects/utils/getBusinessObjectCodeLabel";
import { DEFAULT_BUSINESS_OBJECT_COLOR } from "Features/businessObjects/constants/businessObjectEntityModel";

const POPPER_WIDTH = 360;

// "Sommaire" of the PDF editor: the highlighted passages of the document
// (linked to business objects) grouped by page, in reading order. A row
// click jumps to the page and flashes the passage.
//
// Not portaled: it lives inside the PDF editor layer, so it stays UNDER the
// right tools panel like the rest of the layer.
export default function PopperPdfPassages({
  open,
  anchorEl,
  groups,
  businessObjectById,
  pageNumber,
  onPassageClick,
}) {
  // strings

  const titleS = "Passages surlignés";
  const emptyS =
    "Aucun passage surligné. Sélectionnez un texte du document pour le lier à un objet.";
  const pageS = "Page";
  const deletedObjectS = "Objet supprimé";

  // helpers

  const count = groups.reduce((sum, g) => sum + g.rels.length, 0);

  // render

  return (
    <Popper
      open={open && Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement="bottom-start"
      disablePortal
      modifiers={[{ name: "offset", options: { offset: [0, 8] } }]}
      sx={{ zIndex: 5 }}
    >
      <Paper
        elevation={6}
        sx={{
          width: POPPER_WIDTH,
          maxHeight: "min(60vh, 520px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 1.5,
            py: 1,
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {titleS}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {count}
          </Typography>
        </Box>

        {count === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ p: 1.5 }}>
            {emptyS}
          </Typography>
        ) : (
          <List dense disablePadding sx={{ overflowY: "auto" }}>
            {groups.map((group) => (
              <Box component="li" key={group.pageNumber}>
                <Box component="ul" sx={{ p: 0, m: 0 }}>
                  <ListSubheader
                    sx={{
                      lineHeight: "28px",
                      bgcolor: "background.default",
                      color:
                        group.pageNumber === pageNumber
                          ? "secondary.main"
                          : "text.secondary",
                      fontWeight:
                        group.pageNumber === pageNumber ? "bold" : "normal",
                    }}
                  >
                    {`${pageS} ${group.pageNumber}`}
                  </ListSubheader>
                  {group.rels.map((rel) => {
                    const businessObject =
                      businessObjectById?.[rel.businessObjectId];
                    return (
                      <ListItemButton
                        key={rel.id}
                        onClick={() => onPassageClick(rel)}
                        sx={{ alignItems: "flex-start", gap: 1, py: 0.5 }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: 0.5,
                            flexShrink: 0,
                            mt: 0.6,
                            bgcolor:
                              businessObject?.color ??
                              DEFAULT_BUSINESS_OBJECT_COLOR,
                          }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap>
                            {getBusinessObjectCodeLabel(businessObject) ||
                              deletedObjectS}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {`« ${rel.text ?? ""} »`}
                          </Typography>
                        </Box>
                      </ListItemButton>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </List>
        )}
      </Paper>
    </Popper>
  );
}
