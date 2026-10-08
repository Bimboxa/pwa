import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

// ---------------------------------------------------------------------------
// useAutoSelectFirstPortfolio — with no displayed portfolio (or one that is no
// longer in the scope's list: deleted, scope switch), displays and selects the
// first one. Shared by the left panel tree and the floating manager, so the
// viewport never stays empty whichever host is mounted.
// ---------------------------------------------------------------------------

export default function useAutoSelectFirstPortfolio(portfolios) {
  const dispatch = useDispatch();

  // data

  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );

  // effects

  useEffect(() => {
    if (!portfolios?.length) return;
    if (
      displayedPortfolioId &&
      portfolios.some((p) => p.id === displayedPortfolioId)
    )
      return;
    const first = portfolios[0];
    dispatch(setDisplayedPortfolioId(first.id));
    dispatch(setSelectedItem({ id: first.id, type: "PORTFOLIO" }));
  }, [displayedPortfolioId, portfolios, dispatch]);
}
