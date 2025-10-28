export default function getAnnotationTemplateProps(annotationTemplate) {
  if (!annotationTemplate) return {};

  //const props = { ...annotationTemplate };
  //delete props.id;

  const props = {
    image: annotationTemplate?.image,
    label: annotationTemplate?.label,
    meterByPx: annotationTemplate?.meterByPx,

    fillColor: annotationTemplate?.fillColor,
    iconKey: annotationTemplate?.iconKey,
  };

  return props;
}
