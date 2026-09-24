// Project chat state and scope chat actions while sharing the application store.
// Existing feature hooks keep their Redux API; asynchronous callbacks retain
// the session that started them even after the user selects another session.
export default function createChatSessionStore(store, sessionId) {
  let previousState;
  let projectedState;
  const getState = () => {
    const state = store.getState();
    if (state !== previousState) {
      previousState = state;
      projectedState = {
        ...state,
        chat: { ...state.chat, ...state.chat.sessions[sessionId] },
      };
    }
    return projectedState;
  };
  const dispatch = (action) => {
    if (typeof action === "function") return action(dispatch, getState);
    return store.dispatch(
      action.type?.startsWith("chat/")
        ? { ...action, meta: { ...action.meta, chatSessionId: sessionId } }
        : action
    );
  };
  return { ...store, getState, dispatch };
}
