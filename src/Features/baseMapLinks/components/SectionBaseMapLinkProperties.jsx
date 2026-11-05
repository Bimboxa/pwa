import { Box, Button, Typography } from "@mui/material";
import { SwapHoriz as ReverseIcon } from "@mui/icons-material";

import FieldAnnotationLabel from "Features/annotations/components/FieldAnnotationLabel";
import FieldAnnotationStroke from "Features/annotations/components/FieldAnnotationStroke";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import useBaseMapLinkActions from "../hooks/useBaseMapLinkActions";

// Properties of a section mark ("trait de coupe", BASE_MAP_LINK) — replaces
// the standard annotation properties, which are template-centric (template
// picker, height, quantities, profile / eraser flags…) and mean nothing for
// this helper. Content: the mark's label ("A-A", written on the source mark
// even when its clone is selected), its direction, its stroke colour and
// where the other end of the link sits.
export default function SectionBaseMapLinkProperties({ annotation }) {
  // strings

  const reverseS = "Inverser le sens";
  const reverseHelperS =
    "L'observateur regarde du côté des flèches, à droite du sens du tracé.";
  const planS = "Plan d'origine";
  const locatedS = "Repéré sur";
  const notLocatedS =
    "Non repéré : ouvrez un fond de plan vertical et repérez-le depuis la liste « Traits de coupe ».";

  // data

  const actions = useBaseMapLinkActions(annotation);

  // render

  return (
    <Box
      sx={{ width: 1, p: 1, gap: 1, display: "flex", flexDirection: "column" }}
    >
      <FieldAnnotationLabel annotation={annotation} />

      <WhiteSectionGeneric>
        <Button
          size="small"
          variant="outlined"
          color="secondary"
          startIcon={<ReverseIcon />}
          onClick={actions.reverse}
        >
          {reverseS}
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.5 }}
        >
          {reverseHelperS}
        </Typography>
      </WhiteSectionGeneric>

      <FieldAnnotationStroke annotation={annotation} />

      <WhiteSectionGeneric>
        {actions.counterpart ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
              <b>{actions.isClone ? planS : locatedS}</b>
              {` : ${actions.counterpart.name}`}
            </Typography>
            <Button size="small" onClick={actions.goToCounterpart}>
              Voir
            </Button>
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {notLocatedS}
          </Typography>
        )}
      </WhiteSectionGeneric>
    </Box>
  );
}
