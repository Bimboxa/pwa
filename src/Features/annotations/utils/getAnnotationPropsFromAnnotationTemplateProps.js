export default function getAnnotationPropsFromAnnotationTemplateProps(annotation, annotationTemplateProps) {
    // 1. On crée une copie superficielle (shallow copy) de l'annotation de base
    // pour ne pas muter l'objet original.
    const result = { ...annotation };

    // Sécurité : si le template est vide ou null, on retourne l'annotation telle quelle
    if (!annotationTemplateProps) {
        return result;
    }

    // 2. On parcourt toutes les clés des props du template
    Object.keys(annotationTemplateProps).forEach((key) => {
        const value = annotationTemplateProps[key];

        // 3. La condition stricte demandée : "non null et différent de undefined"
        if (value !== null && value !== undefined) {
            // Cette ligne gère les deux cas :
            // - Si la clé existe dans 'result', elle est remplacée.
            // - Si la clé n'existe pas, elle est ajoutée.
            result[key] = value;
        }
    });

    return result;
}