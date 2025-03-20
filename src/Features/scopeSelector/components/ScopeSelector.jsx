import {useState} from "react";

import PageProjectAndScope from "./PageProjectAndScope";

import PageProjectSelector from "./PageProjectSelector";
import PageScopeSelector from "./PageScopeSelector";
import PageProjectsFromRemoteContainer from "./PageProjectsFromRemoteContainer";

export default function ScopeSelector() {
  // state

  let [page, setPage] = useState("PROJECT_AND_SCOPE");
  const [remoteContainer, setRemoteContainer] = useState(null);

  if (remoteContainer) page = "PROJECTS_FROM_REMOTE_CONTAINER";

  // handlers

  function handleSeeProjectsClick() {
    setPage("PROJECTS");
  }

  function handleSeeScopesClick() {
    setPage("SCOPES");
  }

  // return
  return (
    <>
      {page === "PROJECT_AND_SCOPE" && (
        <PageProjectAndScope
          onSeeProjectsClick={handleSeeProjectsClick}
          onSeeScopesClick={handleSeeScopesClick}
        />
      )}
      {page === "PROJECTS" && (
        <PageProjectSelector onRemoteContainerClick={setRemoteContainer} />
      )}
      {page === "SCOPES" && <PageScopeSelector />}
      {page === "PROJECTS_FROM_REMOTE_CONTAINER" && (
        <PageProjectsFromRemoteContainer remoteContainer={remoteContainer} />
      )}
    </>
  );
}
