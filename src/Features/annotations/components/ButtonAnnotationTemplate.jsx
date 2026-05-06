import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import useAnnotationTemplateCandidates from "../hooks/useAnnotationTemplateCandidates";

import ButtonSelectorAnnotationTemplateVariantDense from "./ButtonSelectorAnnotationTemplateVariantDense";

export default function ButtonAnnotationTemplate({ annotation, bgcolor = null, ...props }) {

    // data

    const { candidates: annotationTemplates, listings } =
        useAnnotationTemplateCandidates(annotation, { variant: "sameType" }) ?? {};
    const updateAnnotation = useUpdateAnnotation();

    // handlers

    async function handleTemplateChange(annotationTemplateId) {
        await updateAnnotation({ id: annotation.id, annotationTemplateId });
    }

    return (
        <ButtonSelectorAnnotationTemplateVariantDense
            selectedTemplateId={annotation?.annotationTemplateId}
            selectedTemplate={annotation}
            displayLabel={annotation?.templateLabel}
            onChange={handleTemplateChange}
            annotationTemplates={annotationTemplates}
            listings={listings}
            bgcolor={bgcolor}
            {...props}
        />
    );
}
