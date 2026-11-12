import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";

import { setIsLocatingComment } from "Features/comments/commentsSlice";

import startAddCommentService from "Features/comments/services/startAddCommentService";

import { ALL_EDITORS } from "../../constants/commandEditors";
import { getCommentCommandGate } from "../../utils/commentCommandState";

// « + Commentaire localisé » (2D + 3D, Commentaires module —
// Features/comments): arms the location pick — the next click in the
// displayed editor (a point of the plan in 2D, a surface in 3D) creates the
// comment there, with the view context, and opens it in its editor. A second
// click on the armed button (or Escape) disarms it.
export default {
  key: "ADD_LOCATED_COMMENT",
  label: "Ajouter un commentaire localisé",
  Icon: AddLocationAltOutlinedIcon,
  editors: ALL_EDITORS,
  getState(ctx) {
    const gate = getCommentCommandGate(ctx);
    if (gate) return gate;
    return { enabled: true, active: Boolean(ctx.isLocatingComment) };
  },
  run(ctx, { dispatch, store }) {
    if (ctx.isLocatingComment) {
      dispatch(setIsLocatingComment(false));
      return;
    }
    startAddCommentService({ located: true, dispatch, store });
  },
};
