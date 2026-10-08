import { useDispatch, useSelector } from "react-redux";

import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import useCreatePortfolioPage from "./useCreatePortfolioPage";

// ---------------------------------------------------------------------------
// useAddPortfolioPage — appends a blank page ("Page N") at the end of the
// portfolio and selects it. Shared by the tree header "+" button and the
// "Nouvelle page" row of SectionPortfolioPages.
// ---------------------------------------------------------------------------

export default function useAddPortfolioPage({ portfolio, pages }) {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const createPage = useCreatePortfolioPage();

  const addPage = async () => {
    if (!portfolio) return null;
    const lastPage = pages?.[pages.length - 1];
    const page = await createPage({
      listing: portfolio,
      projectId,
      title: `Page ${(pages?.length || 0) + 1}`,
      afterSortIndex: lastPage?.sortIndex ?? null,
    });
    dispatch(setDisplayedPortfolioId(portfolio.id));
    dispatch(
      setSelectedItem({
        id: page.id,
        type: "PORTFOLIO_PAGE",
        portfolioId: portfolio.id,
      })
    );
    return page;
  };

  return addPage;
}
