export default function getAnnotationPropsFromAnnotationTemplateProps(annotation, annotationTemplateProps, baseMap) {
    // 1. On crée une copie superficielle (shallow copy) de l'annotation de base
    // pour ne pas muter l'objet original.
    const result = { ...annotation };

    // Libellé propre de l'annotation (champ de la ligne), avant le repli sur
    // le libellé du modèle plus bas : c'est ce que rend l'étiquette
    // ("Etiquette"), volontairement découplée des entités. Déjà posé en amont
    // pour les annotations liées à une entité (useAnnotationsV2), où `label`
    // porte alors le libellé de l'entité.
    if (result.annotationLabel === undefined) {
        result.annotationLabel = annotation?.label;
    }

    // Sécurité : si le template est vide ou null, on retourne l'annotation telle quelle
    if (!annotationTemplateProps) {
        return result;
    }

    const overrideFields = annotationTemplateProps.overrideFields;

    // 2. On parcourt toutes les clés des props du template
    Object.keys(annotationTemplateProps).forEach((key) => {
        if (key === "overrideFields" || key === "hidden" || key === "hideSlope" || key === "slopeFontSize" || key === "material3d" || key === "color3D" || key === "opacity3D" || key === "deltaOffsetZ3d" || key === "colorChannel") return;

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

    // slopeFontSize (« Pente » text size) follows the same template-level rule.
    if (annotationTemplateProps.slopeFontSize !== null && annotationTemplateProps.slopeFontSize !== undefined) {
        result.slopeFontSize = annotationTemplateProps.slopeFontSize;
    }

    // material3d (PHOTOREAL material preset), color3D, opacity3D and
    // deltaOffsetZ3d ("Delta offset 3D", render-only lift added to offsetZ by
    // the 3D builders) are
    // template-owned 3D rendering choices (no per-annotation UI, so not gated
    // by overrideFields). They are fully derived from the template: a value on
    // the template wins, and an unset (null/undefined) template value CLEARS
    // any stale copy the row may carry (older template switches used to stamp
    // them on the row), so the 3D really falls back to the 2D color/opacity.
    for (const key of ["material3d", "color3D", "opacity3D", "deltaOffsetZ3d"]) {
        const value = annotationTemplateProps[key];
        if (value !== null && value !== undefined) {
            result[key] = value;
        } else {
            delete result[key];
        }
    }

    // isExt (exterior-side guide flag) is handled by the generic overrideFields
    // loop above, exactly like height/strokeColor: locked (isExt in
    // overrideFields) => template value wins; unlocked => annotation value is
    // kept untouched (no template fallback).

    // Cross-channel colour: a template whose shape only edits one colour
    // channel (POLYGON → « Remplissage », POLYLINE → « Contour ») can still
    // own annotations of a type read through the OTHER channel — a vertical
    // face drawn in 3D from a POLYGON template is committed as a POLYLINE
    // (commitDrawnFaceService), a « Bande » drawn from a POLYGON template is
    // a STRIP, a flat face from a POLYLINE template is a POLYGON. Every
    // reader (NodePolylineStatic, NodeStripStatic, makeMaterial in 3D,
    // getAnnotationColor) picks the channel from the TYPE, so the hidden
    // channel is mirrored from the edited one here, AFTER the padlock: locked
    // → the template colour, unlocked → the annotation's own colour, in both
    // cases the one the user actually edits. color3D / opacity3D still win
    // in 3D. Applied on every read, so existing rows and templates follow
    // without a migration.
    applyColorChannelMirror(result, annotationTemplateProps.colorChannel);

    result.annotationTemplateProps = annotationTemplateProps;

    return result;
}

const STROKE_DRIVEN_TYPES = ["POLYLINE", "STRIP"];
const FILL_DRIVEN_TYPES = ["POLYGON", "RECTANGLE"];

function applyColorChannelMirror(result, colorChannel) {
    const type = result?.type;
    if (colorChannel === "FILL" && STROKE_DRIVEN_TYPES.includes(type)) {
        if (result.fillColor === null || result.fillColor === undefined) return;
        result.strokeColor = result.fillColor;
        result.strokeOpacity = result.fillOpacity ?? result.strokeOpacity;
    } else if (colorChannel === "STROKE" && FILL_DRIVEN_TYPES.includes(type)) {
        if (result.strokeColor === null || result.strokeColor === undefined) return;
        result.fillColor = result.strokeColor;
        result.fillOpacity = result.strokeOpacity ?? result.fillOpacity;
    }
}