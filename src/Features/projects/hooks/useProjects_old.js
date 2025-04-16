import {useState} from "react";
import {useLiveQuery} from "dexie-react-hooks";

import {useSelector} from "react-redux";

import db from "App/db/db";

export default function useProjects() {
  // main
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const projects = useLiveQuery(async () => {
    setLoading(true);
    const pro = await db.projects.toArray();
    setUpdatedAt(Date.now());
    setLoading(false);
    return pro;
  }, []);

  return {value: projects, loading, updatedAt};
}
