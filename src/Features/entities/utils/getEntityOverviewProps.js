import getEntityMainImage from "./getEntityMainImage";
import theme from "Styles/theme";

export default function getEntityOverviewProps({
  entity,
  baseMapId,
  annotationTemplates,
}) {
  if (!entity) return null;

  let label,
    subLabel,
    imageUrl,
    color,
    annotation = null;

  if (entity?.annotations && baseMapId) {
    const _annotation = entity.annotations.find(
      (a) => a.baseMapId === baseMapId
    );
    if (_annotation) {
      annotation = {
        ..._annotation,
        label: annotationTemplates?.find(
          ({ id }) => _annotation.annotationTemplateId === id
        )?.label,
      };
    }
  }

  // helpers

  //let label = entity.label ?? annotation?.label;
  label = annotation?.label ?? entity.label;
  if (!label) label = "Libellé à définir";
  subLabel = entity.num ? `#${entity.num}` : entity.subLabel;
  const mainImage = getEntityMainImage(entity);

  color = annotation?.fillColor ?? theme.palette.primary.main;

  return {
    label,
    subLabel,
    imageUrl: mainImage?.imageUrlClient,
    color,
  };
}
