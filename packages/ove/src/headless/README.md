# Headless Open Vector Editor

A **UI-agnostic** controller for the Open Vector Editor *engine*. It lets you
drive the editor's state and commands from **any** UI (React, Vue, Svelte,
vanilla JS, a custom canvas, a test) **without mounting the bundled React/SVG
shell, toolbars, menus, or Blueprint dialogs**.

> You bring your own shell and your own canvas. This module gives you the state
> to render and the methods to mutate it, plus a `subscribe` for reactivity.

```ts
import { createHeadlessEditor } from "@teselagen/ove/src/headless";

const editor = createHeadlessEditor({
  sequenceData: { sequence: "gtacACATGAGAGCT", circular: true, name: "myseq" }
});

// reactive: re-render your own UI/canvas on any change
const unsubscribe = editor.subscribe(() => {
  drawMyCanvas({
    sequence: editor.getSequence(),
    features: editor.getFeatures(),
    cutsites: editor.getFilteredCutsites(),
    selection: editor.getSelection()
  });
});

// drive it with semantic commands
editor.select({ start: 2, end: 8 });
editor.reverseComplementSelection();
editor.insertBps("ATG", 0);
const genbank = editor.exportToGenbank();
```

## Why this is possible

The Open Vector Editor is internally layered. Most of it was already
framework-agnostic; only the top two layers are React:

| Layer | Location | React? |
|-------|----------|--------|
| 1. State | `src/redux` | No — plain Redux |
| 2. Derived data | `src/selectors` | No — pure memoized selectors |
| 3. Commands | `src/redux` action creators | No — plain functions |
| 4. Connection (HOCs) | `withEditorProps`, `withEditorInteractions` | **Yes** — react-redux / recompose |
| 5. Rendering | `CircularView`, `RowView`, `LinearView`, toolbars, dialogs | **Yes** — React + SVG |

`createHeadlessEditor` re-exposes layers **1–3** as one semantic object, doing
the same state assembly the React `mapStateToProps`/`mapDispatchToActions` did,
but with no `connect`, no `recompose`, and no DOM rendering.

## API surface (semantic)

**State (getters):**
`getSequenceData`, `getSequence`, `getSequenceLength`, `isCircular`,
`isReadOnly`, `getName`, `getSelection`, `getCaretPosition`, `getFeatures`,
`getParts`, `getPrimers`, `getTranslations`, `getOrfs`, `getCutsites`,
`getFilteredCutsites`, `getSelectedCutsites`, `getFilteredRestrictionEnzymes`,
`getAnnotationVisibility`, `getFindToolState`, `getState` (raw slice).

**Reactivity:** `subscribe(listener) => unsubscribe`.

**Commands (methods):**
- Selection/caret: `select`, `clearSelection`, `setCaretPosition`, `selectAll`
- Loading: `loadSequence`, `updateSequenceData`
- Editing: `insertBps`, `deleteRange`, `replaceRange`,
  `reverseComplementSelection`, `complementSelection`, `rotateToPosition`,
  `setCircular`
- Annotations: `upsert/delete` × `Feature` / `Part` / `Primer` / `Translation`
- Enzymes/visibility/find: `setEnzymeFilter`, `resetEnzymeFilter`,
  `showAnnotationType`, `hideAnnotationType`, `toggleAnnotationType`,
  `setFindText`
- Mode/history: `setReadOnly`, `undo`, `redo`
- Import/export: `importFromString`, `exportToGenbank`, `exportToFasta`,
  `exportToJson`

**Escape hatches:** `store` (the Redux store), `actions` (every bound action
creator), `editorName`, `destroy()`.

## Notifications

Some engine commands surface user feedback through `window.toastr`. In a
headless context there is no UI shell, so a safe no-op shim is installed
automatically. Route messages into your own UI by passing `notify`:

```ts
createHeadlessEditor({
  sequenceData,
  notify: (level, message) => myToast[level](message)
});
```

## Multiple editors / shared store

Each editor owns a named slice of a Redux store. Create several with distinct
`editorName`s, or attach them to an existing store via the `store` option.

## Roadmap (remaining layers)

This module covers the **engine** (state + commands). Two further pieces make a
fully UI-agnostic editor:

1. **Headless render model (for "a canvas").** The geometry needed to *draw*
   the sequence already exists as pure functions
   (`CircularView/PositionAnnotationOnCircle`, `getRangeAnglesSpecial`,
   `RowItem/StackedAnnotations/getStructuredBases`, row mapping in `RowView`).
   These can be lifted into a framework-free "render model" that returns plain
   geometry (arcs, rows, label positions) for any canvas/SVG/WebGL renderer to
   paint — without React.

2. **Headless interaction controller.** The pointer/keyboard logic in
   `withEditorInteractions` (drag-to-select, caret hit-testing, hotkeys via the
   already-exported `getOveHotkeyDefs`) can be decoupled from React event
   binding into a controller you wire to your own DOM/canvas events, calling
   back into `editor.select(...)` / `editor.setCaretPosition(...)`.

The engine here is the foundation both build on.
