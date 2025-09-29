import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

export default function useAnnotationTemplatesByProject() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  return useLiveQuery(async () => {
    if (projectId) {
      return await db.annotationTemplates
        .where("projectId")
        .equals(projectId)
        .toArray();
    } else {
      return await db.annotationTemplates.toArray();
    }
  }, [projectId, annotationsUpdatedAt]);
}
