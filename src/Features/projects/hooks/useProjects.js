import {useState, useEffect} from "react";
import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

import demoProject from "../data/demoProject";

export default function useProjects() {
  // main
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);

  const fetchedProjects = useLiveQuery(async () => {
    const pro = await db.projects.toArray();
    return pro;
  });

  useEffect(() => {
    if (fetchedProjects) {
      setProjects([...fetchedProjects, demoProject]);
      setLoading(false);
    }
  }, [fetchedProjects]);

  return {value: projects, loading};
}
