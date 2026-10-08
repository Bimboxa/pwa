import { useDispatch, useSelector } from "react-redux";

import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import useCreatePortfolio from "./useCreatePortfolio";
import useCreateDetailsPortfolio from "./useCreateDetailsPortfolio";
import useCreateBaseMapPage from "Features/portfolioPages/hooks/useCreateBaseMapPage";

// ---------------------------------------------------------------------------
// useCreatePortfolioFromDialog — creation flow behind DialogCreatePortfolio,
// shared by the left panel (PanelPortfolios) and the floating manager
// (PopperPortfolioManager): plain portfolio with one plan page per selected
// base map, or details portfolio; the new one becomes the displayed /
// selected portfolio.
// ---------------------------------------------------------------------------

export default function useCreatePortfolioFromDialog() {
  const dispatch = useDispatch();

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const createPortfolio = useCreatePortfolio();
  const createDetailsPortfolio = useCreateDetailsPortfolio();
  const createBaseMapPage = useCreateBaseMapPage();

  const createFromDialog = async ({
    title,
    isDetailsPortfolio,
    selectedBaseMapIds = [],
    selectedDetails,
    titleBlock,
  }) => {
    const metadata = titleBlock ? { titleBlock } : undefined;
    let portfolio;
    if (isDetailsPortfolio) {
      portfolio = await createDetailsPortfolio({
        scopeId,
        projectId,
        title,
        baseMapIds: selectedBaseMapIds,
        details: selectedDetails,
        metadata,
      });
    } else {
      portfolio = await createPortfolio({
        scopeId,
        projectId,
        title,
        metadata,
      });
      // one plan page per selected baseMap, in the base map tree order
      let afterSortIndex = null;
      for (const baseMapId of selectedBaseMapIds) {
        const page = await createBaseMapPage({
          listing: portfolio,
          projectId,
          baseMapId,
          afterSortIndex,
        });
        afterSortIndex = page.sortIndex;
      }
    }
    dispatch(setDisplayedPortfolioId(portfolio.id));
    dispatch(setSelectedItem({ id: portfolio.id, type: "PORTFOLIO" }));
    return portfolio;
  };

  return createFromDialog;
}
