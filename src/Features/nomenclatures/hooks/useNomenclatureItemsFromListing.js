import useOrgaData from "Features/orgaData/hooks/useOrgaData";

export default function useNomenclatureItemsFromListing({listing}) {
  // data
  const orgaDataByKey = useOrgaData({variant: "byKey"});

  // edge case

  if (!listing) return null;

  // helper

  const shouldGetItemsFromOrgaData =
    listing?.metadata?.tree?.srcType === "ORGA_DATA";
  const orgaDataKey = listing?.metadata?.tree?.srcKey;

  // helper - items

  const orgaData = orgaDataByKey?.[orgaDataKey];

  console.log("orgaData", orgaData);

  const items = orgaData?.data?.tree;

  return items;
}
