import { useEffect } from "react";

import { useSelector } from "react-redux";

import { useNavigate, useLocation } from "react-router-dom";

export default function useAutoRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  const projectId = useSelector((s) => s.projects.selectedProjectId);

  console.log("projectId", projectId);

  useEffect(() => {
    if (location.pathname === "/" && !projectId) {
      navigate("/dashboard");
    }
  }, [location.pathname, projectId]);
}
