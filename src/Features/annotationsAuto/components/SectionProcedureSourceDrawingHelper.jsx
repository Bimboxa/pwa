import { lazy, Suspense, useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

/**
 * Drawing-helper card of a procedure whose SOURCE annotation is being drawn:
 * while the armed template links (template.procedureKeys) a registry
 * procedure exposing `sourceDrawingHelper: () => import(...)`, that component
 * is lazy-loaded and rendered in the drawing helper — e.g. a schematic
 * telling how the drawn segment orients the generated ouvrage. The component
 * takes no props (org code, same lazy contract as `paramsDialog`).
 *
 * Renders nothing for every other draw.
 */
export default function SectionProcedureSourceDrawingHelper() {
  // data

  const templateId = useSelector((s) =>
    s.mapEditor.enabledDrawingMode
      ? (s.annotations.newAnnotation?.annotationTemplateId ?? null)
      : null
  );
  const appConfig = useAppConfig();

  const procedureKeys = useLiveQuery(async () => {
    if (!templateId) return null;
    const template = await db.annotationTemplates.get(templateId);
    return template && !template.deletedAt
      ? (template.procedureKeys ?? null)
      : null;
  }, [templateId]);

  // helpers

  const entry = procedureKeys?.length
    ? (appConfig?.automatedAnnotationsProcedures ?? []).find(
        (p) => procedureKeys.includes(p.key) && p.sourceDrawingHelper
      )
    : null;
  const loader = entry?.sourceDrawingHelper;
  const Helper = useMemo(() => (loader ? lazy(loader) : null), [loader]);

  // render

  if (!Helper) return null;

  return (
    <Suspense fallback={null}>
      <Helper />
    </Suspense>
  );
}
