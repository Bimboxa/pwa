import {useState} from "react";
import {useDispatch, useSelector} from "react-redux";

import {setProject} from "Features/scopeSelector/scopeSelectorSlice";

import {setSelectedProjectId} from "Features/projects/projectsSlice";
import {setSelectedScopeId} from "Features/scopes/scopesSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import PanelSelectProject from "./PanelSelectProject";
import PanelSelectScope from "./PanelSelectScope";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";

import setInitProjectId from "Features/init/services/setInitProjectId";
import setInitScopeId from "Features/init/services/setInitScopeId";

export default function PanelAddProjectAndScope({containerEl, onClose}) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const project = useSelector((s) => s.scopeSelector.project);

  // helpers - steps

  let step = "PROJECT";
  if (project) step = "SCOPE";

  // helpers

  const selectProjectS =
    appConfig?.strings?.project?.select || "Sélectionnez un projet";
  const selectScopeS =
    appConfig?.strings?.scope?.select || "Sélectionnez un lot ";

  const title = step === "PROJECT" ? selectProjectS : selectScopeS;

  // handlers

  function handleSelectProject(project) {
    dispatch(setProject(project));
  }

  function handleSelectScope(scope) {
    const projectId = project.id;
    //
    setInitProjectId(projectId);
    dispatch(setSelectedProjectId(projectId));
    //
    setInitScopeId(scope.id);
    dispatch(setSelectedScopeId(scope.id));
    //
    onClose();
  }

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={title} onClose={onClose} />
      {step === "PROJECT" && (
        <PanelSelectProject
          containerEl={containerEl}
          onSelect={handleSelectProject}
        />
      )}
      {step === "SCOPE" && (
        <PanelSelectScope
          containerEl={containerEl}
          onSelect={handleSelectScope}
        />
      )}
    </BoxFlexVStretch>
  );
}
