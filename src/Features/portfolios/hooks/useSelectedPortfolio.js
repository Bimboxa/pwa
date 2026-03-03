import { useSelector } from "react-redux";

import { selectSelectedItems } from "Features/selection/selectionSlice";
import useListingById from "Features/listings/hooks/useListingById";

export default function useSelectedPortfolio(options) {
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems.find((i) => i.type === "PORTFOLIO");
  const id = selectedItem?.id;

  const listing = useListingById(id, { withFiles: options?.withFiles });

  const value = listing?.deletedAt ? null : listing ?? null;

  return { value };
}
