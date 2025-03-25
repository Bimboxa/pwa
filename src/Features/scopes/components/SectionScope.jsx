import {useDispatch} from "react-redux";

import {setNewScope, setEditedScope, setIsEditingScope} from "../scopesSlice";

import useIsMobile from "Features/layout/hooks/useIsMobile";
import useScope from "../hooks/useScope";

import {Box} from "@mui/material";

import FormScope from "./FormScope";
import SectionScopeBottomActions from "./SectionScopeBottomActions";

export default function SectionScope({forceNew, onSaved}) {
  const dispatch = useDispatch();

  // data

  const {value: scope, loading} = useScope({forceNew});
  const isMobile = useIsMobile();

  // helpers

  const width = isMobile ? 1 : "400px";

  // handlers

  function handleChange(scope) {
    if (!scope.id) {
      dispatch(setNewScope(scope));
    } else {
      dispatch(setEditedScope(scope));
      dispatch(setIsEditingScope(true));
    }
  }

  return (
    <Box sx={{width}}>
      {!loading && <FormScope scope={scope} onChange={handleChange} />}
      <SectionScopeBottomActions forceNew={forceNew} onSaved={onSaved} />
    </Box>
  );
}
