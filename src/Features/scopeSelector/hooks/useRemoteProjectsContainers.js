import {useState, useEffect} from "react";

export default function useRemoteProjectsContainers() {
  const [projectsContainers, setProjectsContainers] = useState([]);

  useEffect(() => {
    console.log("[ TO DELETE ]");
  }, []);

  return projectsContainers;
}
