export default function getRemoteContainerFromLocalStorage() {
  const propsS = localStorage.getItem("remoteContainer");
  return propsS ? JSON.parse(propsS) : null;
}
