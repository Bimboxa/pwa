import { SYSTEM_ROLE_SOURCE } from "../constants/systemConstants";

// The source template of a system listing: the (single) live template whose
// `systemRole` is SOURCE. `templates`: the templates of the listing.
export default function getSystemSourceTemplate(templates) {
  return (
    (templates ?? []).find(
      (t) => t && !t.deletedAt && t.systemRole === SYSTEM_ROLE_SOURCE
    ) ?? null
  );
}
