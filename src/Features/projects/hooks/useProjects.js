import {useMemo} from "react";
import {useSelector} from "react-redux";
import {getProjectsSelector} from "../services/projectsSelectorCache";

export default function useProjects(options) {
  // data

  const selector = useMemo(() => getProjectsSelector(options), [options]);

  // main

  const projects = useSelector((s) => selector(s));

  return {value: projects, loading: false};
}
