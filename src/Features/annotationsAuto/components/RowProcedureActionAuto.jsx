import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import RowProcedureLauncher from "./RowProcedureLauncher";

/**
 * Toolbar rows (between quantities and actions) for an annotation whose template
 * is linked to one or several ANNOTATIONS_CREATOR procedures. One band per
 * procedure: left = procedure name, right = play / reset / refresh applied to
 * this single annotation as source.
 */
export default function RowProcedureActionAuto({ annotation }) {
  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  const linkedProcedures = (annotation?.annotationTemplate?.procedureKeys ?? [])
    .map((key) => procedures.find((p) => p.key === key))
    .filter((p) => p?.type === "ANNOTATIONS_CREATOR");

  // render

  if (linkedProcedures.length === 0) return null;

  return (
    <>
      {linkedProcedures.map((procedure) => (
        <RowProcedureLauncher
          key={procedure.key}
          procedure={procedure}
          baseMapId={annotation?.baseMapId}
          sourceAnnotationIds={[annotation?.id]}
          sx={{ borderBottom: "1px solid", borderColor: "divider" }}
        />
      ))}
    </>
  );
}
