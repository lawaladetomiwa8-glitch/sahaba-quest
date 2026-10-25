
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

type EditorCommand =
  | "bold"
  | "italic"
  | "formatBlock"
  | "undo"
  | "redo";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function markdownInlineToHtml(value: string): string {
  const protectedValue = value
    .replace(/&lt;\s*\/?\s*u\s*&gt;/gi, (tag) =>
      /\/\s*u/i.test(tag)
        ? "\u0000UNDERLINE_CLOSE\u0000"
        : "\u0000UNDERLINE_OPEN\u0000",
    )
    .replace(/<\/?u>/gi, (tag) =>
      /^<\/u/i.test(tag)
        ? "\u0000UNDERLINE_CLOSE\u0000"
        : "\u0000UNDERLINE_OPEN\u0000",
    );

  let result = escapeHtml(protectedValue);

  result = result
    .replace(/\u0000UNDERLINE_OPEN\u0000/g, "<u>")
    .replace(/\u0000UNDERLINE_CLOSE\u0000/g, "</u>");

  result = result.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, alt: string, url: string) =>
      `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`,
  );

  result = result.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, label: string, url: string) =>
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );

  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");

  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");

  result = result.replace(
    /(^|[^*])\*([^*\n]+)\*(?!\*)/g,
    "$1<em>$2</em>",
  );
  result = result.replace(
    /(^|[^_])_([^_\n]+)_(?!_)/g,
    "$1<em>$2</em>",
  );

  return result;
}

function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";

  const normalizedMarkdown = markdown
    .replace(/&lt;\s*u\s*&gt;/gi, "<u>")
    .replace(/&lt;\s*\/\s*u\s*&gt;/gi, "</u>");

  const lines = normalizedMarkdown.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];

  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];
  let quoteLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;

    output.push(
      `<p>${paragraph.map(markdownInlineToHtml).join("<br />")}</p>`,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!listType) return;

    output.push(
      `<${listType}>${listItems
        .map((item) => `<li>${markdownInlineToHtml(item)}</li>`)
        .join("")}</${listType}>`,
    );

    listType = null;
    listItems = [];
  };

  const flushQuote = () => {
    if (!quoteLines.length) return;

    output.push(
      `<blockquote>${quoteLines
        .map((line) => `<p>${markdownInlineToHtml(line)}</p>`)
        .join("")}</blockquote>`,
    );

    quoteLines = [];
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const quote = line.match(/^\s*>\s?(.*)$/);
    const image = line.match(
      /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/,
    );
    const horizontalRule = line.match(/^\s*([-*_])\1\1+\s*$/);

    if (horizontalRule) {
      flushParagraph();
      flushList();
      flushQuote();
      output.push("<hr />");
      continue;
    }

    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();

      const level = Math.min(4, heading[1].length);
      output.push(
        `<h${level}>${markdownInlineToHtml(heading[2])}</h${level}>`,
      );
      continue;
    }

    if (unordered || ordered) {
      flushParagraph();
      flushQuote();

      const nextType = unordered ? "ul" : "ol";

      if (listType && listType !== nextType) {
        flushList();
      }

      listType = nextType;
      listItems.push((unordered ?? ordered)![1]);
      continue;
    }

    if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1]);
      continue;
    }

    if (image) {
      flushParagraph();
      flushList();
      flushQuote();

      output.push(
        `<p><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" /></p>`,
      );
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushQuote();

  return output.join("");
}

function inlineNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  const children = Array.from(element.childNodes)
    .map(inlineNodeToMarkdown)
    .join("");

  switch (tag) {
    case "strong":
    case "b":
      return `**${children}**`;

    case "em":
    case "i":
      return `*${children}*`;

    case "u":
      return `<u>${children}</u>`;

    case "code":
      return `\`${children}\``;

    case "a": {
      const href = element.getAttribute("href") ?? "";
      return isSafeUrl(href) ? `[${children}](${href})` : children;
    }

    case "br":
      return "\n";

    case "img": {
      const src = element.getAttribute("src") ?? "";
      const alt = element.getAttribute("alt") ?? "";

      return isSafeUrl(src) ? `![${alt}](${src})` : "";
    }

    default:
      return children;
  }
}

function blockNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").trim();
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (/^h[1-4]$/.test(tag)) {
    const level = Number(tag.slice(1));
    return `${"#".repeat(level)} ${inlineNodeToMarkdown(element).trim()}`;
  }

  if (tag === "ul" || tag === "ol") {
    return Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child, index) => {
        const content = Array.from(child.childNodes)
          .map(inlineNodeToMarkdown)
          .join("")
          .trim();

        return tag === "ul"
          ? `- ${content}`
          : `${index + 1}. ${content}`;
      })
      .join("\n");
  }

  if (tag === "blockquote") {
    const content = Array.from(element.childNodes)
      .map(blockNodeToMarkdown)
      .filter(Boolean)
      .join("\n");

    return content
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  if (tag === "hr") {
    return "---";
  }

  if (tag === "p" || tag === "div") {
    return inlineNodeToMarkdown(element).trim();
  }

  return inlineNodeToMarkdown(element).trim();
}

function htmlToMarkdown(root: HTMLElement): string {
  return Array.from(root.childNodes)
    .map(blockNodeToMarkdown)
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ToolbarButton({
  label,
  title,
  onClick,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-gray-200 bg-white px-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing your article here...",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const lastEmittedValue = useRef(value);
  const lastRenderedValue = useRef<string | null>(null);

  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const isFirstRender = lastRenderedValue.current === null;
    const valueWasEmittedByEditor = value === lastEmittedValue.current;

    if (isFirstRender || !valueWasEmittedByEditor) {
      editor.innerHTML = markdownToHtml(value);
      lastEmittedValue.current = value;
    }

    lastRenderedValue.current = value;

    setWordCount(
      value.trim() ? value.trim().split(/\s+/).length : 0,
    );
  }, [value]);

  const updateContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const markdown = htmlToMarkdown(editor);

    lastEmittedValue.current = markdown;
    setWordCount(markdown ? markdown.split(/\s+/).length : 0);
    onChange(markdown);
  }, [onChange]);

  const runCommand = useCallback(
    (command: EditorCommand, commandValue?: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();

      if (command === "formatBlock") {
        document.execCommand(
          "formatBlock",
          false,
          commandValue ?? "p",
        );
      } else {
        document.execCommand(command, false, commandValue);
      }

      updateContent();
    },
    [updateContent],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="article-text-style">
            Text style
          </label>

          <select
            id="article-text-style"
            defaultValue="p"
            onChange={(event) =>
              runCommand("formatBlock", event.target.value)
            }
            className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700"
            title="Choose a text style"
          >
            <option value="p">Paragraph</option>
            <option value="h2">Heading</option>
            <option value="h3">Subheading</option>
            <option value="h4">Small heading</option>
            <option value="blockquote">Quote</option>
          </select>

          <span className="mx-1 hidden h-6 border-l border-gray-300 sm:block" />

          <ToolbarButton
            label="Bold"
            title="Bold"
            onClick={() => runCommand("bold")}
          >
            <strong>B</strong>
          </ToolbarButton>

          <ToolbarButton
            label="Italic"
            title="Italic"
            onClick={() => runCommand("italic")}
          >
            <em>I</em>
          </ToolbarButton>

          <ToolbarButton
            label="Undo"
            title="Undo"
            onClick={() => runCommand("undo")}
          >
            ↶
          </ToolbarButton>

          <ToolbarButton
            label="Redo"
            title="Redo"
            onClick={() => runCommand("redo")}
          >
            ↷
          </ToolbarButton>
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Article content editor"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={updateContent}
        className="article-rich-text-editor min-h-[420px] w-full px-5 py-4 text-sm leading-7 text-gray-800 outline-none"
      />

      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
        <span>Use the toolbar to format your article.</span>
        <span>{wordCount} words</span>
      </div>

      <style jsx>{`
        .article-rich-text-editor:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }

        .article-rich-text-editor :global(h1),
        .article-rich-text-editor :global(h2) {
          font-size: 1.5rem;
          font-weight: 800;
          line-height: 1.4;
          margin: 1.25rem 0 0.65rem;
        }

        .article-rich-text-editor :global(h3) {
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1.5;
          margin: 1rem 0 0.5rem;
        }

        .article-rich-text-editor :global(h4) {
          font-size: 1.1rem;
          font-weight: 700;
          line-height: 1.5;
          margin: 0.85rem 0 0.45rem;
        }

        .article-rich-text-editor :global(p) {
          margin: 0.5rem 0;
        }

        .article-rich-text-editor :global(ul) {
          list-style: disc;
          padding-left: 1.75rem;
          margin: 0.75rem 0;
        }

        .article-rich-text-editor :global(ol) {
          list-style: decimal;
          padding-left: 1.75rem;
          margin: 0.75rem 0;
        }

        .article-rich-text-editor :global(li) {
          margin: 0.25rem 0;
        }

        .article-rich-text-editor :global(blockquote) {
          border-left: 4px solid #0f766e;
          margin: 1rem 0;
          padding: 0.5rem 1rem;
          color: #4b5563;
          background: #f9fafb;
        }

        .article-rich-text-editor :global(a) {
          color: #0f766e;
          text-decoration: underline;
        }

        .article-rich-text-editor :global(img) {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 1rem 0;
          border-radius: 0.5rem;
        }

        .article-rich-text-editor :global(u) {
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .article-rich-text-editor :global(code) {
          background: #f3f4f6;
          padding: 0.1rem 0.3rem;
          border-radius: 0.25rem;
          font-family: monospace;
        }

        .article-rich-text-editor :global(hr) {
          border: 0;
          border-top: 1px solid #d1d5db;
          margin: 1.5rem 0;
        }
      `}</style>
    </div>
  );
}
