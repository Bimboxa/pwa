import {useMemo} from "react";
import {useSelector} from "react-redux";
import {getProjectSelector} from "../services/projectSelectorCache";

export default function useProjects(options) {
  // data

  const selector = useMemo(() => getProjectSelector(options), [options]);

  // main

  const projects = useSelector((s) => selector(s));

  return {value: projects, loading: false};
}
