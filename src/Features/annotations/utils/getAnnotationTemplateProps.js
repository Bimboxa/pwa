export default function getAnnotationTemplateProps(annotationTemplate) {
  if (!annotationTemplate) return {};

  //const props = { ...annotationTemplate };
  //delete props.id;

  const props = {
    type: annotationTemplate?.type,

    image: annotationTemplate?.image,
    label: annotationTemplate?.label,
    labelLegend: annotationTemplate?.labelLegend,
    groupLabel: annotationTemplate?.groupLabel,
    meterByPx: annotationTemplate?.meterByPx,

    fillColor: annotationTemplate?.fillColor,
    fillType: annotationTemplate?.fillType,
    fillOpacity: annotationTemplate?.fillOpacity,

    strokeColor: annotationTemplate?.strokeColor,
    strokeType: annotationTemplate?.strokeType,
    strokeOpacity: annotationTemplate?.strokeOpacity,
    strokeWidth: annotationTemplate?.strokeWidth,
    strokeWidthUnit: annotationTemplate?.strokeWidthUnit,
    dashLength: annotationTemplate?.dashLength,
    dashGap: annotationTemplate?.dashGap,
    //strokeOffset: annotationTemplate?.strokeOffset,

    opacity: annotationTemplate?.opacity,

    size: annotationTemplate?.size,
    sizeUnit: annotationTemplate?.sizeUnit,

    variant: annotationTemplate?.variant,

    cutHost: annotationTemplate?.cutHost,

    iconKey: annotationTemplate?.iconKey,

    hidden: annotationTemplate?.hidden,
    hiddenInLegend: annotationTemplate?.hiddenInLegend,

    hideSlope: annotationTemplate?.hideSlope,

    color3D: annotationTemplate?.color3D,
    opacity3D: annotationTemplate?.opacity3D,

    material3d: annotationTemplate?.material3d,

    isExt: annotationTemplate?.isExt,

    height: annotationTemplate?.height,
    offsetZ: annotationTemplate?.offsetZ,

    // OPENING — door / window symbol type. Only applied to annotations when
    // listed in overrideFields (padlock); otherwise seeded at creation.
    openingType: annotationTemplate?.openingType,

    // LINEAR_LAYOUT (calepinage linéaire) — band width + bar distribution.
    // Only applied to annotations when listed in overrideFields (padlock).
    width: annotationTemplate?.width,
    densityMode: annotationTemplate?.densityMode,
    densityValue: annotationTemplate?.densityValue,
    densityUnitLabel: annotationTemplate?.densityUnitLabel,
    layoutAlign: annotationTemplate?.layoutAlign,
    axisPosition: annotationTemplate?.axisPosition,
    textAlign: annotationTemplate?.textAlign,
    hideBandFill: annotationTemplate?.hideBandFill,

    // FREE_TEXT — text box styling (fillColor / fontSize / textAlign above
    // are shared with other shapes). Only applied to annotations when listed
    // in overrideFields (padlock).
    hasBackground: annotationTemplate?.hasBackground,
    pageFormat: annotationTemplate?.pageFormat,
    textColor: annotationTemplate?.textColor,
    borderColor: annotationTemplate?.borderColor,
    fontFamily: annotationTemplate?.fontFamily,
    fontWeight: annotationTemplate?.fontWeight,
    fontItalic: annotationTemplate?.fontItalic,
    fontUnderline: annotationTemplate?.fontUnderline,
    hasBorder: annotationTemplate?.hasBorder,
    hasPadding: annotationTemplate?.hasPadding,
    hasConnector: annotationTemplate?.hasConnector,

    // CIRCULATION — arrows distributed along the line.
    arrowStep: annotationTemplate?.arrowStep,
    arrowRight: annotationTemplate?.arrowRight,
    arrowLeft: annotationTemplate?.arrowLeft,

    // COTE / RULER display settings — only applied to annotations when listed
    // in overrideFields (the lock on the "Cote" line of the template form).
    unit: annotationTemplate?.unit,
    extensionOffset: annotationTemplate?.extensionOffset,
    extensionOffsetUnit: annotationTemplate?.extensionOffsetUnit,
    decimals: annotationTemplate?.decimals,
    fontSize: annotationTemplate?.fontSize,
    showUnitLabel: annotationTemplate?.showUnitLabel,
    showTotalCote: annotationTemplate?.showTotalCote,
    showRulerLabel: annotationTemplate?.showRulerLabel,

    // Label leader stub ("déport horizontal"). Read-time defaults for the
    // annotations without their own value (not seeded at creation); forced
    // onto every annotation when listed in overrideFields (padlock).
    labelStubLength: annotationTemplate?.labelStubLength,
    labelStubMode: annotationTemplate?.labelStubMode,

    overrideFields: annotationTemplate?.overrideFields,
  };

  return props;
}
