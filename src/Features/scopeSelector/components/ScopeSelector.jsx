import {useEffect} from "react";

import {useDispatch, useSelector} from "react-redux";

import {setProject, setScope} from "Features/scopeSelector/scopeSelectorSlice";

import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import PageProjectAndScope from "./PageProjectAndScope";

import PageProjectSelector from "./PageProjectSelector";
import PageScopeSelector from "./PageScopeSelector";
import PageProjectsFromRemoteContainer from "./PageProjectsFromRemoteContainer";

export default function ScopeSelector() {
  const dispatch = useDispatch();

  // data

  const page = useSelector((s) => s.scopeSelector.page);
  const projectInSelector = useSelector((s) => s.scopeSelector.project);

  const {value: selectedProject} = useSelectedProject();
  const {value: selectedScope} = useSelectedScope();

  useEffect(() => {
    dispatch(setProject(selectedProject));
  }, [selectedProject?.id]);

  useEffect(() => {
    dispatch(setScope(selectedScope));
  }, [selectedScope?.id]);

  // helpers

  const showProjectAndScope = page === "PROJECT_AND_SCOPE" && projectInSelector;
  const showProjects =
    page === "PROJECTS" || (page === "PROJECT_AND_SCOPE" && !projectInSelector);
  const showScopes = page === "SCOPES";

  // return
  return (
    <>
      {showProjectAndScope && <PageProjectAndScope />}
      {showProjects && <PageProjectSelector />}
      {page === "SCOPES" && <PageScopeSelector />}
      {page === "PROJECTS_FROM_REMOTE_CONTAINER" && (
        <PageProjectsFromRemoteContainer />
      )}
    </>
  );
}
