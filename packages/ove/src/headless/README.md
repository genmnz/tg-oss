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

## Driving the old UI from your own shell

You don't mount OVE's `Editor` (the component that bundles the ToolBar,
MenuBar, StatusBar and side panels). Instead you keep **one shared store**
(`editor.store`), render only the canvas view you want, and replace every old
toolbar/sidebar control with calls into the controller. Because the views and
the controller share that store, your shell controls everything and the canvas
re-renders itself.

```tsx
// your shell — only a canvas, no OVE chrome
import { Provider } from "react-redux";
import { CircularView, LinearView, RowView, AlignmentView } from "@teselagen/ove";

<Provider store={editor.store}>
  {view === "circular" && <CircularView editorName={editor.editorName} />}
  {view === "linear"   && <LinearView   editorName={editor.editorName} />}
  {view === "sequence" && <RowView      editorName={editor.editorName} />}
  {view === "alignment"&& <AlignmentView editorName={editor.editorName} />}
</Provider>
```

### Old sidebar "View" options → new way to invoke

The old view switcher just changed which panel was active. Replicate it either
by **mounting the component you want** (above), or by driving OVE's own panel
state: `editor.actions.setPanelAsActive("<type>")`.

| Old sidebar option | What it is in OVE | Invoke from your shell |
|---|---|---|
| **Sequence View** | `RowView` (base-by-base wrapped editor), panel type `"sequence"` | mount `<RowView editorName/>` — or `editor.actions.setPanelAsActive("sequence")` |
| **Circular Map View** | `CircularView`, panel type `"circular"` | mount `<CircularView editorName/>` — or `setPanelAsActive("circular")` |
| **Linear Map View** | `LinearView`, panel type `"rail"` | mount `<LinearView editorName/>` — or `setPanelAsActive("rail")` |
| **Alignment View** | `AlignmentView`, panel type `"alignment"` | feed data with the exported `addAlignment(store, data)`, then mount `<AlignmentView/>` |
| **Flow Cytometry View** | **Not part of OVE** (separate Teselagen app) | host it yourself in your shell |
| **Notebook View** | **Not part of OVE** (separate Teselagen app) | host it yourself in your shell |

> Only the four sequence views above ship with the Open Vector Editor. Flow
> Cytometry and Notebook are separate products — your shell owns those.

### How each capability is invoked through the new wrapper (one-liner each)

- **Circular plasmid maps** — mount `<CircularView editorName/>` on `editor.store`; geometry comes from the pure `PositionAnnotationOnCircle` / `getRangeAnglesSpecial` helpers.
- **Linear sequence views** — mount `<LinearView editorName/>` (overview "rail") or `<RowView editorName/>` (base-by-base) on the same store.
- **Feature editing** — `editor.upsertFeature(feature)` / `editor.deleteFeature(feature)`; read with `editor.getFeatures()`.
- **Annotation editing** — same upsert/delete pattern for parts/primers/translations: `editor.upsertPart` / `upsertPrimer` / `upsertTranslation` (+ matching `delete*`).
- **Primer visualization** — `editor.upsertPrimer(primer)` then `editor.showAnnotationType("primers")`; read with `editor.getPrimers()`.
- **Restriction enzyme analysis** — `editor.setEnzymeFilter([...names])` / `resetEnzymeFilter()`; read cut sites via `editor.getCutsites()` / `getFilteredCutsites()` / `getSelectedCutsites()`.
- **GenBank support** — `editor.importFromString(genbankText)` to load, `editor.exportToGenbank()` to save (also `exportToFasta` / `exportToJson`).
- **Sequence manipulation** — `editor.insertBps`, `deleteRange`, `replaceRange`, `reverseComplementSelection`, `complementSelection`, `rotateToPosition`, `setCircular`.
- **Selection logic** — `editor.select({start,end})` / `setCaretPosition(n)` / `selectAll()` / `clearSelection()`; read with `getSelection()` / `getCaretPosition()`.
- **Translation views** — `editor.upsertTranslation({start,end,forward})` + `editor.showAnnotationType("translations")`; read with `editor.getTranslations()`.
- **ORF visualization** — `editor.showAnnotationType("orfs")`; ORFs are computed for you and read via `editor.getOrfs()`.

