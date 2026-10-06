/*
 * Libraries added by the "Carnet de détail" creation option.
 * The option guarantees a DETAIL (callout bubble) annotation template: it
 * adds the DIVERS library unless one of the configuration's own libraries
 * already provides a DETAIL template (e.g. DECOUVERTE_AUTRES), in which case
 * DIVERS would only duplicate the drawing aids (dimension, ruler, text).
 */

export default function resolveCarnetDetailLibraryKeys({
  carnetDetail,
  configuration,
  appConfig,
}) {
  if (!carnetDetail) return [];

  const libraryKeys = configuration?.annotations?.libraryKeys ?? [];
  const hasDetailTemplate = libraryKeys.some((key) =>
    appConfig?.presetListingsObject?.[key]?.annotationTemplatesLibrary?.some(
      (template) => template.drawingShape === "DETAIL"
    )
  );

  return hasDetailTemplate ? [] : ["DIVERS"];
}
