export default function getAnnotationPropsFromAnnotationTemplateProps(annotation, annotationTemplateProps, baseMap) {
    // 1. On crée une copie superficielle (shallow copy) de l'annotation de base
    // pour ne pas muter l'objet original.
    const result = { ...annotation };

    // Sécurité : si le template est vide ou null, on retourne l'annotation telle quelle
    if (!annotationTemplateProps) {
        return result;
    }

    const overrideFields = annotationTemplateProps.overrideFields;

    // 2. On parcourt toutes les clés des props du template
    Object.keys(annotationTemplateProps).forEach((key) => {
        if (key === "overrideFields" || key === "hidden") return;

        // Only override if the field is in overrideFields (when defined and non-empty)
        if (Array.isArray(overrideFields) && overrideFields.length > 0 && !overrideFields.includes(key)) {
            return;
        }

        if (key === "label") {
            result[key] = annotation?.label || annotationTemplateProps.label;

        }
        else {
            const value = annotationTemplateProps[key];

            // 3. La condition stricte demandée : "non null et différent de undefined"
            if (value !== null && value !== undefined) {
                // Cette ligne gère les deux cas :
                // - Si la clé existe dans 'result', elle est remplacée.
                // - Si la clé n'existe pas, elle est ajoutée.
                result[key] = value;
            }
        }

    });

    // edge case

    const sizeAllowed = !Array.isArray(overrideFields) || overrideFields.length === 0 || overrideFields.includes("size");
    if (sizeAllowed && annotationTemplateProps.size) {
        const { width, height } = annotationTemplateProps.size;
        const sizeUnit = annotationTemplateProps.sizeUnit;

        // On crée une copie superficielle (shallow copy) immédiatement pour éviter de muter l'original
        let bbox = { ...annotation.bbox };

        if (sizeUnit === "PX") {
            // On écrase width et height
            bbox.width = width;
            bbox.height = height;

        } else if (sizeUnit === "M") {
            const meterByPx = baseMap?.getMeterByPx();

            // On vérifie que meterByPx est valide (existe et n'est pas 0)
            if (meterByPx) {
                const widthPx = width / meterByPx;
                const heightPx = height / meterByPx;

                // Plus besoin de vérifier typeof number si on est sûr de nos entrées, 
                // mais garder !isNaN est prudent. On ajoute isFinite pour éviter Infinity.
                if (Number.isFinite(widthPx)) {
                    bbox.width = widthPx;
                }

                if (Number.isFinite(heightPx)) {
                    bbox.height = heightPx;
                }
            }
        }
        result.bbox = bbox;
    }

    // hidden is always applied (not gated by overrideFields)
    if (annotationTemplateProps.hidden !== null && annotationTemplateProps.hidden !== undefined) {
        result.hidden = annotationTemplateProps.hidden;
    }

    result.annotationTemplateProps = annotationTemplateProps;

    return result;
}