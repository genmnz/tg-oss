/**
 * Headless (UI-agnostic) entry point for the Open Vector Editor engine.
 *
 * Import from here when you want to drive the editor's state and commands from
 * your own UI / canvas without mounting the bundled React shell:
 *
 *   import { createHeadlessEditor } from "@teselagen/ove/src/headless";
 *
 * Nothing in this module imports React, so it stays tree-shakeable and usable
 * in any environment that has a DOM `window` (browsers, jsdom, happy-dom).
 */

export { default as createHeadlessEditor } from "./createHeadlessEditor";
export type {
  HeadlessEditor,
  HeadlessEditorOptions
} from "./createHeadlessEditor";
export { installNotifyShim } from "./notify";
export type { NotifyFn, NotifyLevel } from "./notify";
