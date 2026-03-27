export default function resolvePresetListingsAndScopesObjectFromAnnotationTemplatesLibraries(libraries, presetScopeItems) {

    // listings — one per library (unchanged)

    const presetListings = libraries?.map((library) => {
        const listing = {
            key: library.key,
            name: library.name,
            fullName: library.name,
            table: "entities",
            entityModelKey: "annotation",
            color: library.color,
            iconKey: library.iconKey,
            annotationTemplatesLibrary: library.templates,
            keywords: library.keywords,
            articlesNomenclaturesKeys: library.articlesNomenclaturesKeys,
            ...(library.isForBaseMaps && { isForBaseMaps: true }),
        }

        return listing;
    });

    // scopes — from presetScopeItems if provided, otherwise one per library

    let presetScopes;

    if (presetScopeItems?.length > 0) {
        presetScopes = presetScopeItems.map((item) => {
            const matchedListingKeys = item.annotationTemplateKeys?.length > 0
                ? item.annotationTemplateKeys.filter((key) =>
                    libraries.some((lib) => lib.key === key)
                )
                : item.keywords?.length > 0
                    ? libraries
                        .filter((library) =>
                            item.keywords.every((kw) => library.keywords?.includes(kw))
                        )
                        .map((library) => library.key)
                    : [];

            return {
                key: item.key,
                name: item.label,
                listings: matchedListingKeys,
            };
        });
    } else {
        presetScopes = libraries?.map((library) => ({
            key: library.key,
            name: library.name,
            listings: [library.key],
        }));
    }

    // objects

    const presetListingsObject = presetListings.reduce((acc, cur) => {
        acc[cur.key] = cur;
        return acc;
    }, {});

    const presetScopesObject = presetScopes.reduce((acc, cur) => {
        acc[cur.key] = cur;
        return acc;
    }, {});

    // return
    return {
        presetListingsObject,
        presetScopesObject,
        presetScopesSortedKeys: presetScopes?.map((scope) => scope.key),
    };
}
