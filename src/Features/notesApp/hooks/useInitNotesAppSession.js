import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { setNotesAppSession } from "../notesAppSlice";

import useNotesAppConfig from "./useNotesAppConfig";
import { getNotesAppClient } from "../services/notesAppClient";

// Mirrors the notes-app Supabase session into the slice. No-op until the
// appConfig is loaded and the feature enabled for the org; keeps listening
// to auth state changes (sign-in, sign-out, token refresh) afterwards.
export default function useInitNotesAppSession() {
  const dispatch = useDispatch();
  const config = useNotesAppConfig();

  const enabled = Boolean(
    config?.enabled && config?.supabaseUrl && config?.supabaseAnonKey
  );

  useEffect(() => {
    if (!enabled) return;
    let subscription;
    try {
      const client = getNotesAppClient();
      const toSessionMirror = (s) =>
        s ? { userId: s.user?.id, email: s.user?.email } : null;
      client.auth.getSession().then(({ data }) => {
        dispatch(setNotesAppSession(toSessionMirror(data?.session)));
      });
      const { data } = client.auth.onAuthStateChange((_event, s) => {
        dispatch(setNotesAppSession(toSessionMirror(s)));
      });
      subscription = data?.subscription;
    } catch (e) {
      console.log("[notesApp] init session failed", e);
    }
    return () => subscription?.unsubscribe();
  }, [enabled, config?.supabaseUrl, config?.supabaseAnonKey, dispatch]);
}
