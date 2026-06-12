import { createReducer } from "redux-act";

//./caretPosition.js
import createAction from "./utils/createMetaAction";
import { getStoredValue, setStoredValue } from "./utils/safeLocalStorage";
// import createReducer from "./utils/createMergedDefaultStateReducer";

// ------------------------------------
// Actions
// ------------------------------------
export const updateSequenceCase = createAction("updateSequenceCase");

const newVal = getStoredValue("uppercaseSequenceMapFont");

// ------------------------------------
// Reducer
// ------------------------------------
export default createReducer(
  {
    [updateSequenceCase]: (state, payload) => {
      setStoredValue("uppercaseSequenceMapFont", payload);
      return payload;
    }
  },
  newVal || "noPreference" //  noPreference || uppercase || lowercase
);
