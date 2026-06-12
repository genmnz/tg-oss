import { createReducer } from "redux-act";
import createAction from "./utils/createMetaAction";
import { getStoredValue, setStoredValue } from "./utils/safeLocalStorage";

// ------------------------------------
// Actions
// ------------------------------------
export const updateSequenceSpacing = createAction("updateSequenceSpacing");

const newVal = getStoredValue("charWidth");

// ------------------------------------
// Reducer
// ------------------------------------
export default createReducer(
  {
    [updateSequenceSpacing]: (state, payload) => {
      setStoredValue("charWidth", payload);
      return payload;
    }
  },
  newVal || 9
);
