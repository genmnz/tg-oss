import { createReducer } from "redux-act";

//./caretPosition.js
import createAction from "./utils/createMetaAction";
import { getStoredValue, setStoredValue } from "./utils/safeLocalStorage";
// import createReducer from "./utils/createMergedDefaultStateReducer";

// ------------------------------------
// Actions
// ------------------------------------
export const toggleShowGCContent = createAction("toggleShowGCContent");

// ------------------------------------
// Reducer
// ------------------------------------
export default createReducer(
  {
    [toggleShowGCContent]: (state, val) => {
      setStoredValue("showGCContent", val);
      return val;
    }
  },
  getStoredValue("showGCContent")
);
