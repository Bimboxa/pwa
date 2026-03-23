import { useState, useCallback } from "react";

const STORAGE_KEY = "favoriteListings";

function readFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeFavorites(favorites) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
}

function cleanTemplate(t) {
  const { id, listingId, projectId, createdAt, updatedAt, deletedAt, createdByUserIdMaster, ...rest } = t;
  return rest;
}

function cleanListing(listing) {
  return {
    sourceListingId: listing.id,
    name: listing.name,
    color: listing.color,
    iconKey: listing.iconKey,
    entityModelKey: listing.entityModelKey,
    entityModel: listing.entityModel,
    table: listing.table,
    canCreateItem: listing.canCreateItem,
    showNewAnnotationToolbar: listing.showNewAnnotationToolbar,
    isForBaseMaps: listing.isForBaseMaps,
  };
}

export default function useFavoriteListings() {
  const [favoriteListings, setFavoriteListings] = useState(readFavorites);

  const isFavorite = useCallback(
    (listingId) => favoriteListings.some((f) => f.sourceListingId === listingId),
    [favoriteListings]
  );

  const addFavorite = useCallback(({ listing, annotationTemplates }) => {
    setFavoriteListings((prev) => {
      const next = [
        ...prev.filter((f) => f.sourceListingId !== listing.id),
        {
          ...cleanListing(listing),
          annotationTemplates: (annotationTemplates ?? []).map(cleanTemplate),
        },
      ];
      writeFavorites(next);
      return next;
    });
  }, []);

  const removeFavorite = useCallback((listingId) => {
    setFavoriteListings((prev) => {
      const next = prev.filter((f) => f.sourceListingId !== listingId);
      writeFavorites(next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    ({ listing, annotationTemplates }) => {
      if (isFavorite(listing.id)) {
        removeFavorite(listing.id);
      } else {
        addFavorite({ listing, annotationTemplates });
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return { favoriteListings, isFavorite, addFavorite, removeFavorite, toggleFavorite };
}
