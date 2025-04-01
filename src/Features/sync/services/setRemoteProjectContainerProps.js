import store from "App/store";

import {triggerRemoteProjectContainerPropsUpdate} from "../syncSlice";

export default function setRemoteProjectContainerProps(props) {
  const propsS = props ? JSON.stringify(props) : null;
  localStorage.setItem("remoteProjectContainerProps", propsS);
  store.dispatch(triggerRemoteProjectContainerPropsUpdate());
}
