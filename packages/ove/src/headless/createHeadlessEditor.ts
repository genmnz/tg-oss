/**
 * createHeadlessEditor
 * ====================
 *
 * A UI-agnostic ("headless") controller for the Open Vector Editor.
 *
 * The Open Vector Editor is internally layered as:
 *
 *   1. State        -> a Redux store (`packages/ove/src/redux`)
 *   2. Derived data -> pure memoized selectors (`packages/ove/src/selectors`)
 *   3. Commands     -> plain action creators (also under `redux`)
 *   4. Connection   -> React HOCs (`withEditorProps`, `withEditorInteractions`)
 *   5. Rendering    -> React/SVG views (CircularView, RowView, ...)
 *
 * Layers 1-3 are already framework-agnostic. This controller exposes those
 * layers directly as a single, semantic, strongly-described object so the
 * editor's *engine* can be driven from any UI (React, Vue, Svelte, vanilla,
 * a game canvas, a CLI test, ...) without mounting the bundled React shell.
 *
 * You bring your own UI and canvas; this gives you the state to render and the
 * methods to mutate it, plus a `subscribe` for reactivity.
 *
 * @example
 *   const editor = createHeadlessEditor({
 *     sequenceData: { sequence: "gtacACATGAGAGCT", circular: true }
 *   });
 *
 *   editor.subscribe(() => render(editor.getSequenceData(), editor.getCutsites()));
 *   editor.select({ start: 2, end: 8 });
 *   editor.reverseComplementSelection();
 *   const genbank = editor.exportToGenbank();
 */

import { bindActionCreators } from "redux";
import {
  getReverseComplementSequenceAndAnnotations,
  getComplementSequenceAndAnnotations,
  insertSequenceDataAtPositionOrRange,
  rotateSequenceDataToPosition,
  tidyUpSequenceData
} from "@teselagen/sequence-utils";
import {
  jsonToGenbank,
  jsonToFasta,
  anyToJson,
  cleanUpTeselagenJsonForExport
} from "@teselagen/bio-parsers";

import makeStore from "../createVectorEditor/makeStore";
import { actions as rawActions } from "../redux";
import addMetaToActionCreators from "../redux/utils/addMetaToActionCreators";
import updateEditor from "../updateEditor";
import s from "../selectors";
import { installNotifyShim, NotifyFn } from "./notify";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyObj = Record<string, any>;
type Range = { start: number; end: number } & AnyObj;

export interface HeadlessEditorOptions {
  /**
   * Unique name for this editor instance within the shared store. Multiple
   * headless editors can coexist; each owns its own slice of state.
   */
  editorName?: string;
  /** Initial sequence data ({ sequence, circular, features, ... }). */
  sequenceData?: AnyObj;
  /** Start the editor in read-only mode. */
  readOnly?: boolean;
  /** Extra enzymes to consider when computing cut sites. */
  additionalEnzymes?: AnyObj;
  /** Overrides the default enzyme group definitions used for filtering. */
  enzymeGroupsOverride?: AnyObj;
  /**
   * Receives user-facing notifications the engine would normally route through
   * `window.toastr` (undo/redo confirmations, limit warnings, ...). Route these
   * into your own UI. Defaults to a no-op.
   */
  notify?: NotifyFn;
  /**
   * Provide an existing Redux store to attach to (advanced). When omitted a
   * dedicated standalone store is created for this editor.
   */
  store?: AnyObj;
}

export interface HeadlessEditor {
  // ---- identity / escape hatches -----------------------------------------
  /** The editor instance name within the store. */
  readonly editorName: string;
  /** The underlying Redux store (escape hatch for advanced integrations). */
  readonly store: AnyObj;
  /** All editor action creators, bound to dispatch + this editor (advanced). */
  readonly actions: AnyObj;

  // ---- reactivity ---------------------------------------------------------
  /** Subscribe to any state change. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;

  // ---- raw + derived state getters ---------------------------------------
  /** The raw Redux state slice for this editor. */
  getState(): AnyObj;
  /** The full sequence data object as the editor currently sees it. */
  getSequenceData(): AnyObj;
  /** The bare sequence string (DNA/RNA) or protein sequence. */
  getSequence(): string;
  /** Length of the sequence in base pairs. */
  getSequenceLength(): number;
  /** Whether the sequence is circular. */
  isCircular(): boolean;
  /** Whether the editor is currently read-only. */
  isReadOnly(): boolean;
  /** The sequence name. */
  getName(): string;

  /** The current selection range, or `{ start: -1, end: -1 }` when none. */
  getSelection(): Range;
  /** The current caret position, or -1 when none. */
  getCaretPosition(): number;

  getFeatures(): AnyObj;
  getParts(): AnyObj;
  getPrimers(): AnyObj;
  getTranslations(): AnyObj;
  /** Open reading frames computed from the current sequence + settings. */
  getOrfs(): AnyObj;

  /** All cut sites for the current sequence (unfiltered). */
  getCutsites(): AnyObj;
  /** Cut sites after applying the active enzyme filter. */
  getFilteredCutsites(): AnyObj;
  /** Cut sites overlapping the current selection. */
  getSelectedCutsites(): AnyObj;
  /** Restriction enzymes after the active filter. */
  getFilteredRestrictionEnzymes(): AnyObj;

  /** Per-type visibility flags for annotations. */
  getAnnotationVisibility(): AnyObj;
  /** Current find-tool state (search text, matches, options). */
  getFindToolState(): AnyObj;

  // ---- selection / caret commands ----------------------------------------
  /** Set the selection to a range (0-based, inclusive end). */
  select(range: Range): void;
  /** Clear the active selection. */
  clearSelection(): void;
  /** Place the caret at a base-pair position. */
  setCaretPosition(position: number): void;
  /** Select the entire sequence. */
  selectAll(): void;

  // ---- loading / lifecycle -----------------------------------------------
  /** Replace the loaded sequence (and reset relevant view state). */
  loadSequence(sequenceData: AnyObj): void;
  /** Merge a partial update into the current sequence data. */
  updateSequenceData(sequenceData: AnyObj): void;

  // ---- editing commands ---------------------------------------------------
  /**
   * Insert bases at the caret (or replacing a range / the current selection).
   * Honors circularity and origin-spanning selections. Returns the new data.
   */
  insertBps(
    bpsOrSeqData: string | AnyObj,
    atRangeOrCaret?: Range | number
  ): AnyObj;
  /** Delete a range (defaults to the current selection). Returns new data. */
  deleteRange(range?: Range): AnyObj;
  /** Replace a range with the given bases. Returns new data. */
  replaceRange(bpsOrSeqData: string | AnyObj, range: Range): AnyObj;
  /** Reverse-complement the selection (or whole sequence when none). */
  reverseComplementSelection(): void;
  /** Complement the selection (or whole sequence when none). */
  complementSelection(): void;
  /** Rotate a circular sequence so a position becomes the new origin. */
  rotateToPosition(position?: number): void;
  /** Set whether the sequence is circular. */
  setCircular(isCircular: boolean): void;

  // ---- annotation commands ------------------------------------------------
  upsertFeature(feature: AnyObj): void;
  deleteFeature(feature: AnyObj): void;
  upsertPart(part: AnyObj): void;
  deletePart(part: AnyObj): void;
  upsertPrimer(primer: AnyObj): void;
  deletePrimer(primer: AnyObj): void;
  upsertTranslation(translation: AnyObj): void;
  deleteTranslation(translation: AnyObj): void;

  // ---- enzymes / visibility / find ---------------------------------------
  /** Restrict displayed cut sites to the named enzymes. */
  setEnzymeFilter(enzymeNames: string[]): void;
  /** Clear the enzyme filter. */
  resetEnzymeFilter(): void;
  /** Show an annotation type ("features", "cutsites", "orfs", ...). */
  showAnnotationType(type: string): void;
  /** Hide an annotation type. */
  hideAnnotationType(type: string): void;
  /** Toggle an annotation type's visibility. */
  toggleAnnotationType(type: string): void;
  /** Set the find-tool search text. */
  setFindText(text: string): void;

  // ---- mode / history -----------------------------------------------------
  setReadOnly(readOnly: boolean): void;
  undo(): void;
  redo(): void;

  // ---- import / export ----------------------------------------------------
  /** Parse genbank/fasta/json/etc. text into sequence data and load the first. */
  importFromString(content: string, options?: AnyObj): Promise<AnyObj>;
  exportToGenbank(options?: AnyObj): string;
  exportToFasta(options?: AnyObj): string;
  exportToJson(): AnyObj;

  // ---- teardown -----------------------------------------------------------
  /** Remove this editor's state from the store. */
  destroy(): void;
}

export default function createHeadlessEditor(
  options: HeadlessEditorOptions = {}
): HeadlessEditor {
  const {
    editorName = "HeadlessEditor",
    sequenceData,
    readOnly = false,
    additionalEnzymes,
    enzymeGroupsOverride,
    notify,
    store: providedStore
  } = options;

  installNotifyShim(notify);

  const store = providedStore || makeStore();

  // Bind every action creator to this editor instance + dispatch, so callers
  // never have to thread `editorName` or `dispatch` through manually.
  const metaActions = addMetaToActionCreators(rawActions, { editorName });
  const actions: AnyObj = bindActionCreators(metaActions, store.dispatch);

  // Initialize this editor's slice.
  updateEditor(store, editorName, {
    ...(sequenceData ? { sequenceData } : {}),
    readOnly
  });

  // -- internal helpers ------------------------------------------------------
  const getEditorState = (): AnyObj =>
    store.getState().VectorEditor[editorName] || {};

  const getSeqData = (): AnyObj => getEditorState().sequenceData || {};

  const normalizeRange = (range?: Range | number): Range | number => {
    if (range === undefined) {
      const st = getEditorState();
      if (typeof st.caretPosition === "number" && st.caretPosition > -1) {
        return st.caretPosition;
      }
      return st.selectionLayer || { start: -1, end: -1 };
    }
    return range;
  };

  const toSeqDataToInsert = (bpsOrSeqData: string | AnyObj): AnyObj =>
    typeof bpsOrSeqData === "string"
      ? { sequence: bpsOrSeqData }
      : bpsOrSeqData;

  // -- the controller --------------------------------------------------------
  const editor: HeadlessEditor = {
    editorName,
    store,
    actions,

    subscribe(listener) {
      return store.subscribe(listener);
    },

    // ---- state getters -----------------------------------------------------
    getState: getEditorState,
    getSequenceData: getSeqData,
    getSequence: () => getSeqData().sequence || getSeqData().proteinSequence || "",
    getSequenceLength: () => s.sequenceLengthSelector(getEditorState()) || 0,
    isCircular: () => !!getSeqData().circular,
    isReadOnly: () => !!getEditorState().readOnly,
    getName: () => getSeqData().name || "",

    getSelection: () =>
      getEditorState().selectionLayer || { start: -1, end: -1 },
    getCaretPosition: () =>
      typeof getEditorState().caretPosition === "number"
        ? getEditorState().caretPosition
        : -1,

    getFeatures: () => getSeqData().features || {},
    getParts: () => getSeqData().parts || {},
    getPrimers: () => getSeqData().primers || {},
    getTranslations: () => s.translationsSelector(getEditorState()) || {},
    getOrfs: () => s.orfsSelector(getEditorState()) || {},

    getCutsites: () =>
      s.cutsitesSelector(getEditorState(), additionalEnzymes) || {},
    getFilteredCutsites: () =>
      s.filteredCutsitesSelector(
        getEditorState(),
        additionalEnzymes,
        enzymeGroupsOverride
      ) || {},
    getSelectedCutsites: () =>
      s.selectedCutsitesSelector(getEditorState()) || {},
    getFilteredRestrictionEnzymes: () =>
      s.filteredRestrictionEnzymesSelector(getEditorState()) || {},

    getAnnotationVisibility: () => getEditorState().annotationVisibility || {},
    getFindToolState: () => getEditorState().findTool || {},

    // ---- selection / caret -------------------------------------------------
    select(range) {
      actions.selectionLayerUpdate(range);
    },
    clearSelection() {
      actions.selectionLayerClear();
    },
    setCaretPosition(position) {
      actions.caretPositionUpdate(position);
    },
    selectAll() {
      const len = editor.getSequenceLength();
      if (len > 0) actions.selectionLayerUpdate({ start: 0, end: len - 1 });
    },

    // ---- loading -----------------------------------------------------------
    loadSequence(newSeqData) {
      updateEditor(store, editorName, { sequenceData: newSeqData });
    },
    updateSequenceData(partial) {
      actions.updateSequenceData({ ...getSeqData(), ...partial });
    },

    // ---- editing -----------------------------------------------------------
    insertBps(bpsOrSeqData, atRangeOrCaret) {
      const positionOrRange = normalizeRange(atRangeOrCaret);
      const newSeqData = insertSequenceDataAtPositionOrRange(
        toSeqDataToInsert(bpsOrSeqData),
        getSeqData(),
        positionOrRange
      );
      actions.updateSequenceData(newSeqData);
      return newSeqData;
    },
    deleteRange(range) {
      const r = normalizeRange(range) as Range;
      // deleting a range is "inserting nothing" over that range
      const newSeqData = insertSequenceDataAtPositionOrRange(
        { sequence: "" },
        getSeqData(),
        r
      );
      actions.updateSequenceData(newSeqData);
      actions.caretPositionUpdate(typeof r === "number" ? r : r.start);
      return newSeqData;
    },
    replaceRange(bpsOrSeqData, range) {
      const newSeqData = insertSequenceDataAtPositionOrRange(
        toSeqDataToInsert(bpsOrSeqData),
        getSeqData(),
        range
      );
      actions.updateSequenceData(newSeqData);
      return newSeqData;
    },
    reverseComplementSelection() {
      const sel = editor.getSelection();
      const seqData = getSeqData();
      if (sel && sel.start > -1) {
        // RC just the selected range, then splice it back over that range
        // (matching the editor's "Reverse Complement Selection" command).
        const reversed = getReverseComplementSequenceAndAnnotations(seqData, {
          range: sel
        });
        actions.updateSequenceData(
          insertSequenceDataAtPositionOrRange(reversed, seqData, sel, {
            maintainOriginSplit: true
          })
        );
      } else {
        actions.updateSequenceData(
          getReverseComplementSequenceAndAnnotations(seqData)
        );
      }
    },
    complementSelection() {
      const seqData = getSeqData();
      const sel = editor.getSelection();
      if (sel && sel.start > -1) {
        const comp = getComplementSequenceAndAnnotations(seqData, {
          range: sel
        });
        actions.updateSequenceData(
          insertSequenceDataAtPositionOrRange(comp, seqData, sel, {
            maintainOriginSplit: true
          })
        );
      } else {
        actions.updateSequenceData(
          getComplementSequenceAndAnnotations(seqData)
        );
      }
    },
    rotateToPosition(position) {
      const pos =
        typeof position === "number" ? position : editor.getCaretPosition();
      if (!(pos > -1)) return;
      actions.updateSequenceData(
        rotateSequenceDataToPosition(getSeqData(), pos)
      );
    },
    setCircular(isCircular) {
      actions._updateCircular(isCircular);
    },

    // ---- annotations -------------------------------------------------------
    upsertFeature: f => actions.upsertFeature(f),
    deleteFeature: f => actions.deleteFeature(f),
    upsertPart: p => actions.upsertPart(p),
    deletePart: p => actions.deletePart(p),
    upsertPrimer: p => actions.upsertPrimer(p),
    deletePrimer: p => actions.deletePrimer(p),
    upsertTranslation: t => actions._upsertTranslation(t),
    deleteTranslation: t => actions.deleteTranslation(t),

    // ---- enzymes / visibility / find ---------------------------------------
    setEnzymeFilter(enzymeNames) {
      actions.filteredRestrictionEnzymesUpdate(enzymeNames);
    },
    resetEnzymeFilter() {
      actions.filteredRestrictionEnzymesReset();
    },
    showAnnotationType: type => actions.annotationVisibilityShow(type),
    hideAnnotationType: type => actions.annotationVisibilityHide(type),
    toggleAnnotationType: type => actions.annotationVisibilityToggle(type),
    setFindText: text => actions.updateSearchText(text),

    // ---- mode / history ----------------------------------------------------
    setReadOnly(ro) {
      actions.updateReadOnlyMode(ro);
    },
    undo() {
      store.dispatch({ type: "VE_UNDO", meta: { editorName } });
    },
    redo() {
      store.dispatch({ type: "VE_REDO", meta: { editorName } });
    },

    // ---- import / export ---------------------------------------------------
    async importFromString(content, importOptions) {
      const results = await anyToJson(content, importOptions);
      const first = Array.isArray(results) ? results[0] : results;
      if (first && first.parsedSequence) {
        editor.loadSequence(first.parsedSequence);
      }
      return results;
    },
    exportToGenbank(exportOptions) {
      return jsonToGenbank(
        cleanUpTeselagenJsonForExport(getSeqData()),
        exportOptions
      );
    },
    exportToFasta(exportOptions) {
      return jsonToFasta(
        cleanUpTeselagenJsonForExport(getSeqData()),
        exportOptions
      );
    },
    exportToJson() {
      return tidyUpSequenceData(getSeqData(), { annotationsAsObjects: true });
    },

    // ---- teardown ----------------------------------------------------------
    destroy() {
      store.dispatch({ type: "VECTOR_EDITOR_CLEAR", meta: { editorName } });
    }
  };

  return editor;
}
