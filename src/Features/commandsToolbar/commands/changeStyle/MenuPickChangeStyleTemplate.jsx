import { Box, Typography } from "@mui/material";

import MenuPickAnnotationTemplate from "../../components/MenuPickAnnotationTemplate";
import { getTemplateChangeTargets } from "Features/annotations/hooks/useChangeAnnotationsTemplate";

// Template picker of « Changer de style », shared by the command button
// (right-click / group menu) and the helper panel of the armed mode:
// candidates = the templates compatible with at least one of `annotations`
// (same drawing shape — union over a mixed selection), the selection's
// common template highlighted, and on a mixed selection each row says how
// many annotations it would affect. `onChange(templateId, template)`.
export default function MenuPickChangeStyleTemplate({
  open,
  anchorEl,
  onClose,
  annotations,
  onChange,
}) {
  // strings

  const titleS = "Changer de style";
  const emptyS = "Aucun style compatible avec la sélection";

  // helpers

  const count = annotations?.length ?? 0;
  const templateIds = [
    ...new Set((annotations ?? []).map((a) => a.annotationTemplateId)),
  ];
  const commonTemplateId = templateIds.length === 1 ? templateIds[0] : null;

  const filterTemplate = (t) =>
    getTemplateChangeTargets(annotations, t).length > 0;

  // Mixed selection: a candidate may apply to a subset of the rows only.
  const getItemSuffix =
    count > 1
      ? (t) => {
          const n = getTemplateChangeTargets(annotations, t).length;
          return n !== count ? `· ${n}` : null;
        }
      : null;

  // render

  return (
    <MenuPickAnnotationTemplate
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      filterTemplate={filterTemplate}
      onChange={onChange}
      selectedAnnotationTemplateId={commonTemplateId}
      emptyText={emptyS}
      getItemSuffix={getItemSuffix}
    >
      <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {titleS}
        </Typography>
      </Box>
    </MenuPickAnnotationTemplate>
  );
}
