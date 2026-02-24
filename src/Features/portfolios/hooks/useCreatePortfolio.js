import { nanoid } from "nanoid";

import db from "App/db/db";

export default function useCreatePortfolio() {
  const create = async ({ scopeId, projectId, title, sortIndex }) => {
    const portfolio = {
      id: nanoid(),
      scopeId,
      projectId,
      title: title || "Portfolio",
      sortIndex: sortIndex ?? null,
      headerConfig: null,
    };

    await db.portfolios.add(portfolio);
    return portfolio;
  };

  return create;
}
