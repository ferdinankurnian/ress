import { expect, test } from "bun:test";
import { moveItem } from "../src/ui/reorder";

test("moving sources up and down preserves the other sources and the original draft", () => {
  const sources = ["a", "b", "c", "d"];
  expect(moveItem(sources, 3, 0)).toEqual(["d", "a", "b", "c"]);
  expect(moveItem(sources, 0, 3)).toEqual(["b", "c", "d", "a"]);
  expect(sources).toEqual(["a", "b", "c", "d"]);
});

test("dragging beyond either edge stays within the list", () => {
  expect(moveItem(["a", "b", "c"], 1, -10)).toEqual(["b", "a", "c"]);
  expect(moveItem(["a", "b", "c"], 1, 20)).toEqual(["a", "c", "b"]);
  expect(moveItem([], 0, 1)).toEqual([]);
});

test("repeated drag crossings follow the current position", () => {
  let sources = ["a", "b", "c", "d"];
  sources = moveItem(sources, sources.indexOf("a"), 2);
  sources = moveItem(sources, sources.indexOf("a"), 3);
  sources = moveItem(sources, sources.indexOf("a"), 1);
  expect(sources).toEqual(["b", "a", "c", "d"]);
});
