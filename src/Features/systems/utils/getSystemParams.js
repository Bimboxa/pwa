// Parameters of a system instance: procedure defaults < system listing
// (`listing.system.params`) < instance (`source.procedureParams[key]`).
export default function getSystemParams({ source, listing, procedure }) {
  const key = listing?.system?.procedureKey;
  return {
    ...(procedure?.defaultParams ?? {}),
    ...(listing?.system?.params ?? {}),
    ...((key && source?.procedureParams?.[key]) || {}),
  };
}
