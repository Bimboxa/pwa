import { useCallback, useSyncExternalStore } from "react";

import sortAnnotationTemplatesByOrder from "Features/annotations/utils/sortAnnotationTemplatesByOrder";

// ---------------------------------------------------------------------------
// useFavoriteListings — favorite listings ("bibliothèques favorites"): a copy
// of a listing + its annotation templates, kept in localStorage so it can be
// re-created in any project. Keyed by `sourceListingId`.
// One module-level store shared by every component (useSyncExternalStore):
// a rename / delete made in one dialog is seen at once by the heart of the
// listing properties panel, the "..." menu of the active listing, etc.
// ---------------------------------------------------------------------------

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // quota / private mode: keep the in-memory copy
  }
}

// store

let favoritesCache = readFavorites();
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return favoritesCache;
}

function setFavorites(updater) {
  const next =
    typeof updater === "function" ? updater(favoritesCache) : updater;
  favoritesCache = next;
  writeFavorites(next);
  listeners.forEach((listener) => listener());
}

// helpers

function cleanTemplate(t) {
  const {
    id,
    listingId,
    projectId,
    createdAt,
    updatedAt,
    deletedAt,
    createdByUserIdMaster,
    ...rest
  } = t;
  return rest;
}

function cleanListing(listing) {
  return {
    sourceListingId: listing.id,
    name: listing.name,
    avatarString: listing.avatarString ?? null,
    color: listing.color,
    iconKey: listing.iconKey,
    entityModelKey: listing.entityModelKey,
    entityModel: listing.entityModel,
    table: listing.table,
    canCreateItem: listing.canCreateItem,
    showNewAnnotationToolbar: listing.showNewAnnotationToolbar,
    autoNumberAnnotations: listing.autoNumberAnnotations,
    autoNumberPrefix: listing.autoNumberPrefix,
    autoNumberPadStart: listing.autoNumberPadStart,
  };
}

export default function useFavoriteListings() {
  const favoriteListings = useSyncExternalStore(subscribe, getSnapshot);

  const isFavorite = useCallback(
    (listingId) =>
      favoriteListings.some((f) => f.sourceListingId === listingId),
    [favoriteListings]
  );

  const addFavorite = useCallback(({ listing, annotationTemplates }) => {
    setFavorites((prev) => [
      ...prev.filter((f) => f.sourceListingId !== listing.id),
      {
        ...cleanListing(listing),
        // sorted (orderIndex + groups consolidated) while ids are still there:
        // the array order is what the re-creation follows
        annotationTemplates: sortAnnotationTemplatesByOrder(
          annotationTemplates ?? []
        ).map(cleanTemplate),
      },
    ]);
  }, []);

  const removeFavorite = useCallback((listingId) => {
    setFavorites((prev) => prev.filter((f) => f.sourceListingId !== listingId));
  }, []);

  const renameFavorite = useCallback((listingId, name) => {
    const cleanName = name?.trim();
    if (!cleanName) return;
    setFavorites((prev) =>
      prev.map((f) =>
        f.sourceListingId === listingId ? { ...f, name: cleanName } : f
      )
    );
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

  return {
    favoriteListings,
    isFavorite,
    addFavorite,
    removeFavorite,
    renameFavorite,
    toggleFavorite,
  };
}
