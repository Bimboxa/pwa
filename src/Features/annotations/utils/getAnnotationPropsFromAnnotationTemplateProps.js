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
        if (key === "overrideFields" || key === "hidden" || key === "hideSlope" || key === "material3d") return;

        // Only override fields explicitly listed in overrideFields
        if (!Array.isArray(overrideFields) || !overrideFields.includes(key)) {
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

    // sizeUnit is coupled to size: a numeric size is meaningless without its
    // unit, so whenever size is overridden by the template we also push the
    // template's sizeUnit. Otherwise an annotation keeps the unit it was created
    // with and two annotations sharing the same template (and same size value)
    // can render at completely different scales (e.g. 8 PX vs 8 CM).
    if (sizeAllowed && annotationTemplateProps.sizeUnit !== null && annotationTemplateProps.sizeUnit !== undefined) {
        result.sizeUnit = annotationTemplateProps.sizeUnit;
    }

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

    // hideSlope is a template-level display flag and is always applied
    // (not a per-annotation style override, so not gated by overrideFields).
    if (annotationTemplateProps.hideSlope !== null && annotationTemplateProps.hideSlope !== undefined) {
        result.hideSlope = annotationTemplateProps.hideSlope;
    }

    // material3d (PHOTOREAL material preset) is a template-level rendering
    // choice and is always applied (not a per-annotation style override, so
    // not gated by overrideFields).
    if (annotationTemplateProps.material3d !== null && annotationTemplateProps.material3d !== undefined) {
        result.material3d = annotationTemplateProps.material3d;
    }

    // isExt (exterior-side guide flag) is handled by the generic overrideFields
    // loop above, exactly like height/strokeColor: locked (isExt in
    // overrideFields) => template value wins; unlocked => annotation value is
    // kept untouched (no template fallback).

    result.annotationTemplateProps = annotationTemplateProps;

    return result;
}