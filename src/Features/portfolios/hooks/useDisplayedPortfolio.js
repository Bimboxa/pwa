import { useSelector } from "react-redux";

import useListingById from "Features/listings/hooks/useListingById";

export default function useDisplayedPortfolio(options) {
  const id = useSelector((s) => s.portfolios.displayedPortfolioId);

  const listing = useListingById(id, { withFiles: options?.withFiles });

  const value = listing?.deletedAt ? null : listing ?? null;

  return { value };
}
