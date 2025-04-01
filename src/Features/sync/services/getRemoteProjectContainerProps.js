export default function getRemoteProjectContainerProps() {
  const propsS = localStorage.getItem("remoteProjectContainerProps");
  return propsS ? JSON.parse(propsS) : null;
}
