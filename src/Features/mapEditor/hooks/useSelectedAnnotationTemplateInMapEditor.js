import { useSelector } from "react-redux";

import db from "App/db/db";
import { useLiveQuery } from "dexie-react-hooks";

export default function useSelectedAnnotationTemplateInMapEditor() {
  const id = useSelector((s) => s.mapEditor.selectedAnnotationTemplateId);

  return useLiveQuery(async () => {
    return await db.annotationTemplates.get(id);
  });
}
