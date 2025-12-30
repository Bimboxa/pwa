export default function resolvePresetListingsAndScopesObjectFromAnnotationTemplatesLibraries(libraries) {

    // listings

    const presetListings = libraries?.map((library) => {
        const listing = {
            key: library.key,
            //name: library.name,
            name: "Repérage",
            table: "entities",
            entityModelKey: "annotation",
            color: library.color,
            iconKey: library.iconKey,
            annotationTemplatesLibrary: library.templates,
        }

        return listing;
    });

    // scopes

    const presetScopes = libraries?.map((library) => {
        const presetScope = {
            key: library.key,
            name: library.name,
            listings: [library.key],
        }

        return presetScope;
    });

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