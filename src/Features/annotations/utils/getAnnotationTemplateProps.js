export default function getAnnotationTemplateProps(annotationTemplate) {
  if (!annotationTemplate) return {};

  //const props = { ...annotationTemplate };
  //delete props.id;

  const props = {
    image: annotationTemplate?.image,
    label: annotationTemplate?.label,
    meterByPx: annotationTemplate?.meterByPx,

    fillColor: annotationTemplate?.fillColor,
    fillType: annotationTemplate?.fillType,
    fillOpacity: annotationTemplate?.fillOpacity,

    strokeColor: annotationTemplate?.strokeColor,
    strokeType: annotationTemplate?.strokeType,
    strokeOpacity: annotationTemplate?.strokeOpacity,
    strokeWidth: annotationTemplate?.strokeWidth,
    strokeWidthUnit: annotationTemplate?.strokeWidthUnit,
    //strokeOffset: annotationTemplate?.strokeOffset,

    cutHost: annotationTemplate?.cutHost,

    iconKey: annotationTemplate?.iconKey,

    hidden: annotationTemplate?.hidden,
  };

  return props;
}
