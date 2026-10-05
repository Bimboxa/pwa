/**
 * Selection item of an automated procedure (selection slice): opens
 * PanelProcedureProperties in the right panel. `listingId` is the listing the
 * procedure is linked to (listing.procedureKeys) — the panel's back target and
 * the scope of its templates / sources; null for a procedure opened outside a
 * listing.
 */
export default function getProcedureSelectedItem({ procedureKey, listingId }) {
  return {
    id: `PROCEDURE::${procedureKey}::${listingId ?? ""}`,
    type: "PROCEDURE",
    procedureKey,
    listingId: listingId ?? null,
  };
}
