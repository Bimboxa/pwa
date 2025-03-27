import db from "App/db/db";

export default function useUpdateListing() {
  const update = async (updates) => {
    const listingId = updates.id;

    const updatedAt = new Date(Date.now()).toISOString();

    await db.listings.update(listingId, {...updates, updatedAt});
  };

  return update;
}
