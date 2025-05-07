import {Box} from "@mui/material";

import SearchBar from "Features/search/components/SearchBar";

export default function SectionSearch({searchText, onChange}) {
  return (
    <Box sx={{width: 1, p: 1}}>
      <SearchBar
        value={searchText}
        onChange={onChange}
        placeholder="Recherche ..."
      />
    </Box>
  );
}
