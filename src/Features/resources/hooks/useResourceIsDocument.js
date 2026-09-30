import { useEffect, useState } from "react";

import db from "App/db/db";

import detectIsPdfDocumentService from "../services/detectIsPdfDocumentService";

// Is a PDF resource a text DOCUMENT (selectable text layer + highlights
// linked to business objects) or a PLAN (page rendered as an image)?
// resource.isDocument when set; rows created before the field are detected
// at first opening — the result is used right away, persisting is best
// effort (a resource can only be updated by its creator). PDF pages kept as
// base map sources are plans by construction.
export default function useResourceIsDocument(resource, file) {
  // {resourceId, isDocument}: detection result for a legacy row
  const [detected, setDetected] = useState(null);

  // helpers

  const resourceId = resource?.id;
  const isPdf = resource?.fileType === "PDF";
  const isBaseMapSource =
    resource?.kind === "PDF_PAGE" || resource?.kind === "PDF_SOURCE";
  const hasStoredValue = typeof resource?.isDocument === "boolean";
  const needsDetection = isPdf && !isBaseMapSource && !hasStoredValue;
  const isDocument =
    isPdf &&
    (hasStoredValue
      ? resource.isDocument
      : detected?.resourceId === resourceId && detected.isDocument);

  // effects

  useEffect(() => {
    if (!needsDetection || !file) return;
    let cancelled = false;
    (async () => {
      const value = await detectIsPdfDocumentService({ file });
      if (cancelled) return;
      setDetected({ resourceId, isDocument: value });
      try {
        await db.resources.update(resourceId, { isDocument: value });
      } catch (e) {
        console.warn("[resources] isDocument not persisted", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsDetection, file, resourceId]);

  // handlers

  async function setIsDocument(value) {
    if (!resourceId || value === isDocument) return;
    setDetected({ resourceId, isDocument: value });
    await db.resources.update(resourceId, { isDocument: value });
  }

  return { isDocument: Boolean(isDocument), setIsDocument };
}
