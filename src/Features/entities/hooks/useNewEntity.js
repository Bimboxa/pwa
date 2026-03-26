import { useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import useEntities from "./useEntities";
import useEntityFormTemplate from "./useEntityFormTemplate";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useNewEntity() {
  // init
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const { value: selectedListing } = useSelectedListing();

  const newEntity = useSelector((s) => s.entities.newEntity);
  const template = useEntityFormTemplate({ listingId: selectedListingId });

  // Skip the heavy useEntities → useAnnotationsV2 chain when no auto-increment needed
  const hasAutoIncrementFields = template?.fields?.some(
    (f) => f.options?.increment === "auto"
  );
  const { value: entities } = useEntities({ wait: !hasAutoIncrementFields });

  // Memoize the auto-increment result — use entitiesUpdatedAt as stable dep
  const prevResultRef = useRef(null);

  const result = useMemo(() => {
    const autoFields = template?.fields?.filter((field) => {
      return field.options?.increment === "auto";
    });

    const autoNew = {};
    autoFields?.forEach((field) => {
      const fieldKey = field.key;
      const values = entities
        ?.map((entity) => parseInt(entity[fieldKey]))
        .filter((value) => !isNaN(value) && isFinite(value));
      const max = values?.length > 0 ? Math.max(...values) : 0;
      const fieldValue = max + 1;
      autoNew[fieldKey] = fieldValue.toString();
    });

    return {
      ...newEntity,
      ...autoNew,
    };
  }, [newEntity, template, entities]);

  // Stable reference: only return a new object if values actually changed
  const serialized = JSON.stringify(result);
  if (JSON.stringify(prevResultRef.current) === serialized) {
    return prevResultRef.current;
  }
  prevResultRef.current = result;
  return result;
}
