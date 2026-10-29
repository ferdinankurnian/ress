import { Readability } from "@mozilla/readability";

// Bundled into extraction.generated.ts by `bun scripts/build-reader.ts`.
// Run against a clone so switching modes never changes the publisher's page.
(() => {
  const bridge = (window as unknown as { ReactNativeWebView?: { postMessage: (data: string) => void } }).ReactNativeWebView;
  if (!bridge || window.top !== window) return;
  try {
    const clone = document.cloneNode(true) as Document;
    const image = document.querySelector<HTMLMetaElement>('meta[property="og:image"], meta[name="twitter:image"]')?.content || "";
    const article = new Readability(clone, { maxElemsToParse: 60_000 }).parse();
    if (!article?.content) throw new Error("No article");
    // An inert document prevents event handlers in publisher HTML from running.
    // Only text leaves this document; its HTML is never rendered by the app.
    const content = new DOMParser().parseFromString(article.content, "text/html").body;
    const blocks = /^(P|DIV|SECTION|ARTICLE|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE|FIGCAPTION|TR)$/;
    function text(node: Node): string {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent?.replace(/\s+/g, " ") || "";
      if (!(node instanceof Element)) return "";
      if (/^(SCRIPT|STYLE|NOSCRIPT|IFRAME|FORM)$/.test(node.tagName)) return "";
      if (node.tagName === "BR") return "\n";
      if (node.tagName === "PRE") return `\n\n${node.textContent || ""}\n\n`;
      const value = Array.from(node.childNodes).map(text).join("");
      return blocks.test(node.tagName) ? `\n\n${node.tagName === "LI" ? "• " : ""}${value}\n\n` : value;
    }
    bridge.postMessage(JSON.stringify({
      type: "ress:article", url: location.href, title: article.title || document.title,
      content: text(content).replace(/[ \t]+\n/g, "\n").replace(/\n(?:[ \t]*\n){2,}/g, "\n\n").trim().slice(0, 150_000),
      byline: article.byline || "", image,
    }));
  } catch {
    bridge.postMessage(JSON.stringify({ type: "ress:unavailable", url: location.href }));
  }
})();
