/*
 * Restricts a parsed project output (`data` of parsePromptIaProjectOutput)
 * to the ONE scope being created from the Krto configuration "Prompt IA".
 *
 * The returned scope carries the id and the name of the Krto under creation
 * (the business-object listings and the issues are keyed on `scope.id`), so
 * the model's own scope id / name never reach the database. Several
 * returned scopes are merged (listings, business-object listings and issues
 * concatenated in order, duplicate listing names suffixed); none yields an
 * empty scope — the base maps are still created.
 *
 * Pure: relative imports only, so it runs under `node --test`.
 *
 * @param {{ scopes?: Array }} data
 * @param {{ scopeId: string, scopeName: string }} target
 * @returns {{ scope: { id, name, listings, businessObjectListings, issues }, warnings: string[] }}
 */
export default function normalizePromptIaScopeOutput(
  data,
  { scopeId, scopeName }
) {
  const scopes = Array.isArray(data?.scopes) ? data.scopes : [];
  const warnings = [];

  if (scopes.length === 0) {
    warnings.push(
      "Aucune liste renvoyée par l'IA : seuls les fonds de plan sont créés."
    );
    return {
      scope: {
        id: scopeId,
        name: scopeName,
        listings: [],
        businessObjectListings: [],
        issues: [],
      },
      warnings,
    };
  }

  if (scopes.length === 1) {
    const [scope] = scopes;
    return {
      scope: {
        ...scope,
        id: scopeId,
        name: scopeName,
        listings: scope.listings ?? [],
        businessObjectListings: scope.businessObjectListings ?? [],
        issues: scope.issues ?? [],
      },
      warnings,
    };
  }

  warnings.push(
    `${scopes.length} scopes renvoyés par l'IA, fusionnés dans « ${scopeName} ».`
  );
  return {
    scope: {
      id: scopeId,
      name: scopeName,
      listings: dedupListingNames(scopes.flatMap((s) => s.listings ?? [])),
      businessObjectListings: scopes.flatMap(
        (s) => s.businessObjectListings ?? []
      ),
      issues: scopes.flatMap((s) => s.issues ?? []),
    },
    warnings,
  };
}

// Same listing name in two merged scopes → "Nom", "Nom (2)", "Nom (3)"…
function dedupListingNames(listings) {
  const seen = new Map();
  return listings.map((listing) => {
    const key = (listing.name ?? "").trim().toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1
      ? listing
      : { ...listing, name: `${listing.name} (${count})` };
  });
}
