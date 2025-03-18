import {useState} from "react";

import PageProjectAndScope from "./PageProjectAndScope";

import PageProjectSelector from "./PageProjectSelector";
import PageScopeSelector from "./PageScopeSelector";

export default function ScopeSelector() {
  // state

  const [page, setPage] = useState("PROJECT_AND_SCOPE");

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
      {page === "PROJECTS" && <PageProjectSelector />}
      {page === "SCOPES" && <PageScopeSelector />}
    </>
  );
}
