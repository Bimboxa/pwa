import { useMemo } from "react";
import { Provider, useStore } from "react-redux";
import createChatSessionStore from "../utils/createChatSessionStore";

export default function ChatSessionProvider({ sessionId, children }) {
  const store = useStore();
  const sessionStore = useMemo(
    () => createChatSessionStore(store, sessionId),
    [store, sessionId]
  );
  return <Provider store={sessionStore}>{children}</Provider>;
}
