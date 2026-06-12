import { describe, it, expect } from "bun:test";
import createHeadlessEditor from "../src/headless/createHeadlessEditor";

const seq = "gtacacatgagagct"; // 15 bp

describe("createHeadlessEditor", () => {
  it("loads a sequence and exposes semantic state getters", () => {
    const editor = createHeadlessEditor({
      sequenceData: { sequence: seq, circular: true, name: "myseq" }
    });
    expect(editor.getSequence().toLowerCase()).toBe(seq);
    expect(editor.getSequenceLength()).toBe(15);
    expect(editor.isCircular()).toBe(true);
    expect(editor.getName()).toBe("myseq");
    editor.destroy();
  });

  it("notifies subscribers on state change", () => {
    const editor = createHeadlessEditor({ sequenceData: { sequence: seq } });
    let calls = 0;
    const unsub = editor.subscribe(() => {
      calls++;
    });
    editor.select({ start: 2, end: 6 });
    expect(calls).toBeGreaterThan(0);
    expect(editor.getSelection()).toEqual({ start: 2, end: 6 });
    unsub();
    const after = calls;
    editor.clearSelection();
    expect(calls).toBe(after); // no more notifications after unsubscribe
    editor.destroy();
  });

  it("inserts bps at the caret", () => {
    const editor = createHeadlessEditor({ sequenceData: { sequence: "aaaa" } });
    editor.setCaretPosition(2);
    editor.insertBps("tt", 2);
    expect(editor.getSequence().toLowerCase()).toBe("aattaa");
    editor.destroy();
  });

  it("deletes the current selection", () => {
    const editor = createHeadlessEditor({ sequenceData: { sequence: "aacccaa" } });
    editor.select({ start: 2, end: 4 });
    editor.deleteRange();
    expect(editor.getSequence().toLowerCase()).toBe("aaaa");
    editor.destroy();
  });

  it("reverse complements a selection", () => {
    const editor = createHeadlessEditor({
      sequenceData: { sequence: "aaagggttt" }
    });
    // RC of "ggg" (positions 3-5) is "ccc"
    editor.select({ start: 3, end: 5 });
    editor.reverseComplementSelection();
    expect(editor.getSequence().toLowerCase()).toBe("aaacccttt");
    editor.destroy();
  });

  it("exports to genbank", () => {
    const editor = createHeadlessEditor({
      sequenceData: { sequence: seq, name: "myseq" }
    });
    const gb = editor.exportToGenbank();
    expect(typeof gb).toBe("string");
    expect(gb).toContain("LOCUS");
    editor.destroy();
  });

  it("toggles annotation visibility", () => {
    const editor = createHeadlessEditor({ sequenceData: { sequence: seq } });
    editor.hideAnnotationType("cutsites");
    expect(editor.getAnnotationVisibility().cutsites).toBe(false);
    editor.showAnnotationType("cutsites");
    expect(editor.getAnnotationVisibility().cutsites).toBe(true);
    editor.destroy();
  });
});
