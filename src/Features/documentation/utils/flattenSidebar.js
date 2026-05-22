export default function flattenSidebar(sidebar) {
  if (!sidebar?.items) return [];
  const out = [];
  const walk = (items) => {
    for (const item of items) {
      if (item.type === "doc") {
        out.push({id: item.id, title: item.title ?? item.id});
      } else if (item.type === "category" && item.items) {
        walk(item.items);
      }
    }
  };
  walk(sidebar.items);
  return out;
}
