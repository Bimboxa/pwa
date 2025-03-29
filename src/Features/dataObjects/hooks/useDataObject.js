import useEntities from "Features/entities/hooks/useEntities";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useDataObject() {
  const {value: keyValuePairs, loading} = useEntities(); // {id, listingId,key, value}
  const {value: listing} = useSelectedListing();
  const formTemplate = listing?.formTemplate;

  const keyValueByKey = keyValuePairs?.reduce((acc, kvp) => {
    if (kvp?.key) {
      acc[kvp.key] = kvp.value;
    }
    return acc;
  }, {});

  const dataObject = {};

  formTemplate?.fields?.forEach((field) => {
    if (field?.key && keyValueByKey[field.key]) {
      dataObject[field.key] = keyValueByKey[field.key];
    }
  });

  return {loading, dataObject, formTemplate};
}
