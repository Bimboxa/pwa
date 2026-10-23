import { useMemo } from "react";
import { useSelector } from "react-redux";

import { DEFAULT_BUSINESS_OBJECT_TYPE_KEY } from "../data/businessObjectTypesCatalog";
import resolveBusinessObjectType from "../utils/resolveBusinessObjectType";

// Type entry (strings resolved for the org + features) of a business object
// type key — for the places where the module IS the type (creation button,
// creation dialog). See utils/resolveBusinessObjectType.
export default function useBusinessObjectType(
  typeKey = DEFAULT_BUSINESS_OBJECT_TYPE_KEY
) {
  const appConfigStringsByType = useSelector(
    (s) => s.appConfig.value?.strings?.businessObjectTypes
  );

  return useMemo(
    () => resolveBusinessObjectType({ typeKey, appConfigStringsByType }),
    [typeKey, appConfigStringsByType]
  );
}
