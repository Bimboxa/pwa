import { useEffect } from "react";

import { useSelector } from "react-redux";

import { useNavigate, useLocation } from "react-router-dom";

export default function useAutoRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const initSelectProjectDone = useSelector(
    (s) => s.projects.initSelectProjectDone
  );

  useEffect(() => {
    if (location.pathname === "/" && !projectId && initSelectProjectDone) {
      //navigate("/dashboard");
    }
  }, [location.pathname, projectId, initSelectProjectDone]);
}
