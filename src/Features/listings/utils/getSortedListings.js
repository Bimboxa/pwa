export default function getSortedListings(listings, sortedIds) {
  // edge case
  if (!listings) return;

  // helpers

  const listingsById = listings.reduce((acc, listing) => {
    acc[listing.id] = listing;
    return acc;
  }, {});

  let unsortedIds = listings.map((listing) => listing.id);

  // sort listings

  sortedIds = sortedIds || [];

  const sortedListings = [];

  sortedIds.forEach((id) => {
    if (listingsById[id]) {
      sortedListings.push(listingsById[id]);
      unsortedIds = unsortedIds.filter((unsortedId) => unsortedId !== id);
    }
  });

  // add unsorted listings
  unsortedIds.forEach((id) => {
    if (listingsById[id]) {
      sortedListings.push(listingsById[id]);
    }
  });

  return sortedListings;
}
