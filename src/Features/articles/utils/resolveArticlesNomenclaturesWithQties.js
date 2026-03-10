import db from "App/db/db";

/**
 * Parses a formula string like "OUVRAGE:SOL.S" into its three parts.
 *
 * Syntax: "<nomenclatureKey>:<categoryKey>.<metric>"
 * - nomenclatureKey : key of the mapping nomenclature  (e.g. "OUVRAGE")
 * - categoryKey     : key of the category inside that nomenclature (e.g. "SOL")
 * - metric          : which numeric field to sum on the annotation  (e.g. "S" → annotation.surface)
 *
 * Returns null when the formula is absent or unparseable.
 */
function parseFormula(formula) {
    if (!formula || typeof formula !== "string") return null;
    const match = formula.match(/^([^:]+):([^.]+)\.(.+)$/);
    if (!match) return null;
    return {
        nomenclatureKey: match[1],
        categoryKey: match[2],
        metric: match[3],
    };
}

/**
 * Map metric codes → annotation field names.
 * Extend this map whenever new metrics are needed.
 */
const METRIC_TO_FIELD = {
    S: "surface",    // surface en m²
    P: "perimeter",  // périmètre
    L: "length",     // longueur
    H: "height",     // hauteur
    V: "volume",     // volume
};

function getAnnotationValue(annotation, metric) {
    const field = METRIC_TO_FIELD[metric] ?? metric.toLowerCase();
    return Number(annotation.qties?.[field] ?? annotation[field]) || 0;
}

/**
 * resolveArticlesNomenclaturesWithQties
 *
 * For each articlesNomenclature and each of its articles:
 *   1. Parse the article.formula  → { nomenclatureKey, categoryKey, metric }
 *   2. Look up the relations stored in relAnnotationMappingCategory for
 *      (nomenclatureKey + categoryKey) that belong to the given annotations.
 *   3. Sum the requested metric over those annotations.
 *   4. Return the nomenclature enriched with qty on every article.
 *
 * @param {object}   params
 * @param {object[]} params.annotations          – annotation objects (must have .id)
 * @param {object[]} params.mappingCategories     – from appConfig.mappingCategories
 * @param {object[]} params.articlesNomenclatures – resolved nomenclature objects
 *
 * @returns {Promise<object[]>} articlesNomenclatures with qty filled in on each article
 */
export default async function resolveArticlesNomenclaturesWithQties({
    annotations,
    mappingCategories,
    articlesNomenclatures,
}) {
    if (!annotations?.length || !articlesNomenclatures?.length) {
        return articlesNomenclatures ?? [];
    }

    // ── Step 1 : build a fast lookup  annotationId → annotation ──────────────
    const annotationById = Object.fromEntries(
        annotations.map((a) => [a.id, a])
    );

    const annotationIds = annotations.map((a) => a.id);

    // ── Step 2 : load all relevant relations from the DB ─────────────────────
    // We fetch all relations whose annotationId is in our set (one query per id
    // is fine for realistic sizes; switch to a compound index query if needed).
    const allRels = await db.relAnnotationMappingCategory
        .where("annotationId")
        .anyOf(annotationIds)
        .toArray();

    // ── Step 2b: build parent lookup from mappingCategories ──────────────────
    // For each nomenclature, map each categoryKey to its parent categoryKeys
    // based on the "num" hierarchy (e.g. "2.1" is a child of "2").
    // numToKey: "OUVRAGE|2.1" → "VCT"
    // keyToNum: "OUVRAGE|VCT" → "2.1"
    const numToKey = {};
    const keyToNum = {};
    for (const mc of mappingCategories) {
        const nomKey = mc.nomenclature?.key;
        if (!nomKey) continue;
        for (const cat of mc.categories ?? []) {
            numToKey[`${nomKey}|${cat.num}`] = cat.key;
            keyToNum[`${nomKey}|${cat.key}`] = cat.num;
        }
    }

    // Index by "nomenclatureKey|categoryKey" → annotationId[]
    // Also propagate to parent categories based on num hierarchy.
    const relIndex = {};
    for (const rel of allRels) {
        const key = `${rel.nomenclatureKey}|${rel.categoryKey}`;
        if (!relIndex[key]) relIndex[key] = [];
        relIndex[key].push(rel.annotationId);

        // Propagate to parent categories
        const num = keyToNum[key];
        if (num && num.includes(".")) {
            const parts = num.split(".");
            // Walk up the hierarchy: "2.1.3" → "2.1" → "2"
            for (let i = parts.length - 1; i >= 1; i--) {
                const parentNum = parts.slice(0, i).join(".");
                const parentKey = numToKey[`${rel.nomenclatureKey}|${parentNum}`];
                if (parentKey) {
                    const parentRelKey = `${rel.nomenclatureKey}|${parentKey}`;
                    if (!relIndex[parentRelKey]) relIndex[parentRelKey] = [];
                    relIndex[parentRelKey].push(rel.annotationId);
                }
            }
        }
    }

    // ── Step 3 : resolve qty for each article ────────────────────────────────
    const result = articlesNomenclatures.map((nomenclature) => {
        const articles = (nomenclature.articles ?? []).map((article) => {
            const parsed = parseFormula(article.formula);

            if (!parsed) return { ...article, qty: null };

            const { nomenclatureKey, categoryKey, metric } = parsed;
            const relKey = `${nomenclatureKey}|${categoryKey}`;
            const matchingAnnotationIds = relIndex[relKey] ?? [];

            const qty = matchingAnnotationIds.reduce((sum, annotationId) => {
                const annotation = annotationById[annotationId];
                return annotation ? sum + getAnnotationValue(annotation, metric) : sum;
            }, 0);

            return { ...article, qty: Math.round(qty * 100) / 100 };
        });

        return { ...nomenclature, articles };
    });

    return result;
}