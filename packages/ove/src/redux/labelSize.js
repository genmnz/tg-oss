import { createReducer } from "redux-act";

import createAction from "./utils/createMetaAction";
import { getStoredValue, setStoredValue } from "./utils/safeLocalStorage";

// ------------------------------------
// Actions
// ------------------------------------
export const changeLabelSize = createAction("changeLabelSize");

const newVal = getStoredValue("labelSize");

// ------------------------------------
// Reducer
// ------------------------------------
export default createReducer(
  {
    [changeLabelSize]: (state, payload) => {
      setStoredValue("labelSize", payload);
      return payload;
    }
  },
  newVal ? parseInt(newVal) : 8 //  8 is 100% label size
);
