import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import startAddCommentService from "Features/comments/services/startAddCommentService";

import { ALL_EDITORS } from "../../constants/commandEditors";
import { getCommentCommandGate } from "../../utils/commentCommandState";

// « + Info » (2D + 3D, Infos module — Features/comments):
// creates a comment that is NOT located, with the view context of the
// displayed editor, and opens it in its editor. Without any comment listing
// in the scope, the "new listing" dialog opens first.
export default {
  key: "ADD_COMMENT",
  label: "Ajouter une info",
  Icon: InfoOutlinedIcon,
  editors: ALL_EDITORS,
  getState(ctx) {
    const gate = getCommentCommandGate(ctx);
    if (gate) return gate;
    if (ctx.isLocatingComment) {
      return { enabled: false, reason: "Localisation en cours" };
    }
    return { enabled: true };
  },
  run(ctx, { dispatch, store }) {
    startAddCommentService({ located: false, dispatch, store });
  },
};
