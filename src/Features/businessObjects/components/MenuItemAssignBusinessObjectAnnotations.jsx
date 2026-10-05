import { MenuItem } from "@mui/material";

import useAssignBusinessObjectToAnnotations from "../hooks/useAssignBusinessObjectToAnnotations";

// Menu entry "Affecter les annotations à l'intérieur" of a business object
// (types with the `assignByGeometry` feature). Mounted only while its menu is
// open, so its useAnnotationsV2 instance is transient.
export default function MenuItemAssignBusinessObjectAnnotations({
  businessObject,
  onClick,
}) {
  const { assignForBusinessObject } = useAssignBusinessObjectToAnnotations();

  // handlers

  function handleClick() {
    onClick?.();
    assignForBusinessObject(businessObject);
  }

  // render

  return (
    <MenuItem onClick={handleClick}>
      Affecter les annotations à l&apos;intérieur
    </MenuItem>
  );
}
