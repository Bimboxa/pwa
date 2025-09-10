import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import { useLiveQuery } from "dexie-react-hooks";

import ListItemsGenericVariantSortable from "Features/layout/components/ListItemsGenericVariantSortable";

import db from "App/db/db";

export default function SectionLegendInListPanel({ listing }) {
  // data - legendEntity

  const legendEntity = useLiveQuery(async () => {
    if (listing?.id) {
      return await db.legends.where("listingId").equals(listing?.id).first();
    }
  }, [listing?.id]);

  // data - update

  const updateEntity = useUpdateEntity();

  // helpers

  const items = legendEntity?.sortedItems ?? [];
  console.log("debug_0910 items", items, legendEntity);

  // handlers

  async function handleSortedItemsChange(sortedItems) {
    await updateEntity(legendEntity?.id, { sortedItems });
  }

  return (
    <ListItemsGenericVariantSortable
      items={items}
      onSortEnd={handleSortedItemsChange}
    />
  );
}
