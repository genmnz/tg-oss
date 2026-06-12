import { createReducer } from "redux-act";

import createAction from "./utils/createMetaAction";
import { getStoredValue, setStoredValue } from "./utils/safeLocalStorage";

// ------------------------------------
// Actions
// ------------------------------------
export const changeLabelLineIntensity = createAction(
  "changeLabelLineIntensity"
);

const newVal = getStoredValue("labelLineIntensity");

// ------------------------------------
// Reducer
// ------------------------------------
export default createReducer(
  {
    [changeLabelLineIntensity]: (state, payload) => {
      setStoredValue("labelLineIntensity", payload);
      return payload;
    }
  },
  newVal ? parseFloat(newVal) : 0.1 //  0.1 (low) || 0.4 (med) || 0.7 (high) || 1.0 (full)
);
