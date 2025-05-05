import useOrgaData from "Features/orgaData/hooks/useOrgaData";

export default function useNomenclaturesByKey() {
  // data
  const orgaDataItems = useOrgaData({
    nomenclaturesOnly: false,
  });

  // edge case

  if (!orgaDataItems) return null;

  // main

  const nomenclaturesByKey = {};

  orgaDataItems?.forEach((item) => {
    nomenclaturesByKey[item.key] = item.data;
  });

  // return
  return nomenclaturesByKey;
}
