import db from "App/db/db";

// Plain field updates on a POV record (description, sortIndex...). The povs
// table is live-queried, so no manual refresh trigger is needed.
export default function useUpdatePov() {
  return async function updatePov(id, fields) {
    if (!id || !fields) return;
    await db.povs.update(id, fields);
  };
}
