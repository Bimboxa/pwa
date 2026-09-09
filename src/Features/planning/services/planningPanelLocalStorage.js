const LS_KEY = "planningPanelLayout";

// {open: boolean, height: number} — layout of the bottom planning panel,
// persisted per browser like the coupled-navigation preference.
export function loadPlanningPanelLayout() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === null) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function storePlanningPanelLayout(layout) {
  try {
    const previous = loadPlanningPanelLayout();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...previous, ...layout }));
  } catch {
    // ignore quota / unavailable storage
  }
}
