import { useDispatch, useSelector } from "react-redux";

import {
  setFavorites,
  addFavoriteLocal,
  removeFavoriteLocal,
} from "../scopeFavoritesSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import resolveUrl from "Features/appConfig/utils/resolveUrl";
import resolveRequestBody from "Features/appConfig/utils/resolveRequestBody";
import transformObject from "Features/misc/utils/transformObject";
import resolveRoute from "Features/remoteScopeConfigurations/utils/resolveRoute";

export default function useScopeFavorites() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const jwt = useSelector((s) => s.auth.jwt);
  const userProfile = useSelector((s) => s.auth.userProfile);
  const favorites = useSelector((s) => s.scopeFavorites.favorites);

  // config

  const favoritesConfig = appConfig?.features?.scopeFavorites;
  const mapping = favoritesConfig?.mapping;

  // helpers

  function isFavorite(scopeId) {
    return favorites.some((f) => String(f.scopeId) === String(scopeId));
  }

  async function callEndpoint(endpointConfig, context) {
    const fetchParams = endpointConfig?.fetchParams;
    if (!fetchParams) throw new Error("missing fetchParams");

    const urlConfig = {
      ...fetchParams.url,
      route: resolveRoute(fetchParams.url.route, context),
    };
    const resolvedUrl = resolveUrl(urlConfig);
    const resolvedBody = resolveRequestBody(fetchParams.body, context);

    const response = await fetch(resolvedUrl, {
      method: fetchParams.method || "GET",
      headers: {
        ...(jwt && { Authorization: `Bearer ${jwt}` }),
        "Content-Type": "application/json",
      },
      body: resolvedBody ? JSON.stringify(resolvedBody) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for url ${resolvedUrl}`);
    }

    return response;
  }

  // fetch

  const fetchFavorites = async () => {
    try {
      if (!favoritesConfig?.getByUser) return [];
      const response = await callEndpoint(favoritesConfig.getByUser, {
        userProfile,
      });
      const data = await response.json();
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      const _favorites = mapping
        ? items.map((item) => transformObject(item, mapping))
        : items;
      dispatch(setFavorites(_favorites));
      return _favorites;
    } catch (error) {
      // endpoints may not be live yet — degrade silently, keep local state
      console.error("[useScopeFavorites] fetch error", error);
      return null;
    }
  };

  // add / remove (optimistic, rollback on error)

  const addFavorite = async (scopeMeta) => {
    const scopeId = scopeMeta?.scopeId;
    if (!scopeId || isFavorite(scopeId)) return;
    dispatch(addFavoriteLocal(scopeMeta));
    try {
      if (!favoritesConfig?.add) return;
      await callEndpoint(favoritesConfig.add, { scopeId, userProfile });
    } catch (error) {
      console.error("[useScopeFavorites] add error", error);
      dispatch(removeFavoriteLocal(scopeId));
    }
  };

  const removeFavorite = async (scopeId) => {
    const favorite = favorites.find(
      (f) => String(f.scopeId) === String(scopeId)
    );
    if (!favorite) return;
    dispatch(removeFavoriteLocal(scopeId));
    try {
      if (!favoritesConfig?.remove) return;
      await callEndpoint(favoritesConfig.remove, { scopeId, userProfile });
    } catch (error) {
      console.error("[useScopeFavorites] remove error", error);
      dispatch(addFavoriteLocal(favorite));
    }
  };

  const toggleFavorite = async (scopeMeta) => {
    if (isFavorite(scopeMeta?.scopeId)) {
      await removeFavorite(scopeMeta.scopeId);
    } else {
      await addFavorite(scopeMeta);
    }
  };

  return {
    favorites,
    isFavorite,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
  };
}
