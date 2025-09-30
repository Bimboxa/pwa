import { useSelector } from "react-redux";
import useAnnotationTemplates from "./useAnnotationTemplates";

export default function useSelectedAnnotationTemplateInMapEditor() {
  const templateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );
  const annotationTemplates = useAnnotationTemplates();
  return annotationTemplates?.find((t) => t.id === templateId);
}
