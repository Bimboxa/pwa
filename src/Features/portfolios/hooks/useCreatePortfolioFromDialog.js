import { useDispatch, useSelector } from "react-redux";

import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import useCreatePortfolio from "./useCreatePortfolio";
import useCreateDetailsPortfolio from "./useCreateDetailsPortfolio";
import useCreateBaseMapPage from "Features/portfolioPages/hooks/useCreateBaseMapPage";

import db from "App/db/db";

// ---------------------------------------------------------------------------
// useCreatePortfolioFromDialog — creation flow behind DialogCreatePortfolio,
// shared by the left panel (PanelPortfolios) and the floating manager
// (PopperPortfolioManager): plain portfolio with one plan page per selected
// base map, details portfolio, or phases journal (« Journal des phases »: one
// plan page per phase and per selected base map, titled with the phase name
// and showing the annotations present in that phase); the new one becomes
// the displayed / selected portfolio.
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
    // « Journal des phases »: the ordered phases ([{id, label}]), else empty
    phases = [],
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
      // one plan page per selected baseMap, in the base map tree order —
      // repeated for each phase in a phases journal
      let afterSortIndex = null;
      const baseMapNameById = {};
      if (phases.length > 0 && selectedBaseMapIds.length > 1) {
        const baseMaps = await db.baseMaps.bulkGet(selectedBaseMapIds);
        baseMaps.forEach((baseMap) => {
          if (baseMap) baseMapNameById[baseMap.id] = baseMap.name;
        });
      }
      for (const phase of phases.length > 0 ? phases : [null]) {
        for (const baseMapId of selectedBaseMapIds) {
          // the phase name is the title; several base maps: the plan name
          // tells the pages of a phase apart
          const baseMapName = baseMapNameById[baseMapId];
          const title = phase
            ? [phase.label, baseMapName].filter(Boolean).join(" \u00b7 ")
            : undefined;
          const page = await createBaseMapPage({
            listing: portfolio,
            projectId,
            baseMapId,
            afterSortIndex,
            title,
            phaseId: phase?.id,
          });
          afterSortIndex = page.sortIndex;
        }
      }
    }
    dispatch(setDisplayedPortfolioId(portfolio.id));
    dispatch(setSelectedItem({ id: portfolio.id, type: "PORTFOLIO" }));
    return portfolio;
  };

  return createFromDialog;
}
