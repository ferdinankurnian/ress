import { expect, test } from "bun:test";
import { createArticleImagePreparer } from "../src/ui/articleImages";
import type { Article } from "../src/data/feeds";
const article = (image?: string): Article => ({
  id: "saved-article", sourceId: "feed", source: "Any RSS feed", title: "Title",
  url: "https://example.test/post", date: "", summary: "Summary", content: "Content", image,
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};

test("articles are not published until square dimensions are known", async () => {
  const dimensions = deferred<{ width: number; height: number }>();
  const started = deferred<void>();
  const prepare = createArticleImagePreparer({
    read: async () => [], write: async () => {},
    measure: () => { started.resolve(); return dimensions.promise; },
  });
  let published = false;
  const original = article("square");
  const result = prepare([original]).then(rows => { published = true; return rows; });
  await started.promise;
  expect(published).toBe(false);
  dimensions.resolve({ width: 640, height: 640 });
  expect((await result)[0].thumbnailLayout).toBe("square");
  expect(original).not.toHaveProperty("thumbnailLayout");
  expect((await result)[0].id).toBe("saved-article");
});

test("non-square and missing images keep their intended layouts", async () => {
  const prepare = createArticleImagePreparer({
    read: async () => [], write: async () => {},
    measure: async uri => uri === "portrait" ? { width: 300, height: 600 } : { width: 600, height: 300 },
  });
  expect((await prepare([article("wide"), article("portrait"), article()]))
    .map(a => a.thumbnailLayout)).toEqual(["standard", "standard", "hidden"]);
});

test("dimensions persist across app sessions without probing images again", async () => {
  let cache: unknown = [];
  const storage = { read: async () => cache, write: async (value: unknown) => { cache = value; } };
  const first = createArticleImagePreparer({ ...storage, measure: async () => ({ width: 128, height: 128 }) });
  await first([article("square")]);
  const next = createArticleImagePreparer({ ...storage, measure: async () => { throw new Error("offline"); } });
  expect((await next([article("square")]))[0].thumbnailLayout).toBe("square");
});

test("late dimensions cannot change a timed-out card on refresh or remount", async () => {
  const late = deferred<{ width: number; height: number }>();
  let calls = 0;
  const prepare = createArticleImagePreparer({
    read: async () => [], write: async () => {}, timeoutMs: 10,
    measure: () => { calls++; return late.promise; },
  });
  const first = await prepare([article("slow")]);
  expect(first[0].thumbnailLayout).toBe("hidden");
  late.resolve({ width: 400, height: 400 });
  expect((await prepare([article("slow")]))[0].thumbnailLayout).toBe("hidden");
  expect(first[0].thumbnailLayout).toBe("hidden");
  expect(calls).toBe(1);
});

test("overlapping preparations share probes and changed URLs get fresh dimensions", async () => {
  const dimensions = deferred<{ width: number; height: number }>();
  let calls = 0;
  const prepare = createArticleImagePreparer({
    read: async () => [], write: async () => {},
    measure: async uri => { calls++; return uri === "old" ? dimensions.promise : { width: 800, height: 400 }; },
  });
  const first = prepare([article("old"), article("old")]);
  const second = prepare([article("old")]);
  dimensions.resolve({ width: 400, height: 400 });
  expect((await first).map(a => a.thumbnailLayout)).toEqual(["square", "square"]);
  expect((await second)[0].thumbnailLayout).toBe("square");
  expect(calls).toBe(1);
  expect((await prepare([article("new")]))[0].thumbnailLayout).toBe("standard");
  expect(calls).toBe(2);
});

test("bad metadata and failed image requests do not break the library", async () => {
  const prepare = createArticleImagePreparer({
    read: async () => [["bad", { width: 0, height: 0 }], ["square", { width: 64, height: 64 }]],
    write: async () => { throw new Error("storage full"); },
    measure: async uri => {
      if (uri === "invalid") return { width: NaN, height: Infinity };
      throw new Error("offline");
    },
  });
  expect((await prepare([article("bad"), article("square"), article("invalid")]))
    .map(a => a.thumbnailLayout)).toEqual(["hidden", "square", "hidden"]);
});
