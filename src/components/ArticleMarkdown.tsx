
import React from "react";

type ArticleMarkdownProps = {
  content: string;
};

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "image"; alt: string; url: string }
  | { type: "divider" };

function parseInline(input: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern =
    /(!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|<u>([\s\S]*?)<\/u>|&lt;u&gt;([\s\S]*?)&lt;\/u&gt;|&lt;u&gt;([\s\S]*?)&lt;\/u&gt;|&lt;\/u&gt;|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`]+)`)/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(input.slice(lastIndex, match.index));
    }

    if (match[1] && match[3]) {
      nodes.push(
        <img
          key={key++}
          src={match[3]}
          alt={match[2] ?? ""}
          loading="lazy"
          style={{
            display: "block",
            maxWidth: "100%",
            height: "auto",
            borderRadius: 12,
            margin: "18px 0",
          }}
        />,
      );
    } else if (match[4] && match[5]) {
      nodes.push(
        <a
          key={key++}
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[4]}
        </a>,
      );
    } else if (match[6] !== undefined || match[7] !== undefined || match[8] !== undefined) {
      const text = match[6] ?? match[7] ?? match[8] ?? "";
      nodes.push(<u key={key++}>{parseInline(text)}</u>);
    } else if (match[9] || match[10]) {
      nodes.push(
        <strong key={key++}>{match[9] ?? match[10]}</strong>,
      );
    } else if (match[11] || match[12]) {
      nodes.push(<em key={key++}>{match[11] ?? match[12]}</em>);
    } else if (match[13]) {
      nodes.push(<code key={key++}>{match[13]}</code>);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < input.length) {
    nodes.push(input.slice(lastIndex));
  }

  return nodes;
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let index = 0;

  function flushParagraph() {
    if (paragraph.length > 0) {
      const text = paragraph.join(" ").trim();
      if (text) {
        blocks.push({ type: "paragraph", text });
      }
      paragraph = [];
    }
  }

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (!trimmed) {
      flushParagraph();
      index++;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      index++;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "divider" });
      index++;
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      const quoteLines: string[] = [];

      while (
        index < lines.length &&
        lines[index].trim().startsWith(">")
      ) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index++;
      }

      blocks.push({
        type: "quote",
        text: quoteLines.join(" "),
      });
      continue;
    }

    const image = trimmed.match(
      /^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/,
    );

    if (image) {
      flushParagraph();
      blocks.push({
        type: "image",
        alt: image[1],
        url: image[2],
      });
      index++;
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];

      while (
        index < lines.length &&
        /^[-*+]\s+/.test(lines[index].trim())
      ) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ""));
        index++;
      }

      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];

      while (
        index < lines.length &&
        /^\d+[.)]\s+/.test(lines[index].trim())
      ) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ""));
        index++;
      }

      blocks.push({ type: "ordered-list", items });
      continue;
    }

    paragraph.push(trimmed);
    index++;
  }

  flushParagraph();
  return blocks;
}

export default function ArticleMarkdown({
  content,
}: ArticleMarkdownProps) {
  const blocks = parseBlocks(content);

  const headingStyle: React.CSSProperties = {
    margin: "30px 0 12px",
    lineHeight: 1.35,
    fontWeight: 900,
    color: "var(--foreground)",
  };

  const paragraphStyle: React.CSSProperties = {
    margin: "0 0 18px",
    fontSize: 16,
    lineHeight: 1.95,
    color: "var(--foreground)",
    overflowWrap: "anywhere",
  };

  return (
    <div className="article-markdown">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading": {
            const Tag = (
              block.level === 1
                ? "h2"
                : block.level === 2
                  ? "h3"
                  : block.level === 3
                    ? "h4"
                    : "h5"
            ) as "h2" | "h3" | "h4" | "h5";

            const fontSize =
              block.level === 1 ? 30 :
              block.level === 2 ? 24 :
              block.level === 3 ? 19 : 17;

            return (
              <Tag
                key={index}
                style={{ ...headingStyle, fontSize }}
              >
                {parseInline(block.text)}
              </Tag>
            );
          }

          case "paragraph":
            return (
              <p key={index} style={paragraphStyle}>
                {parseInline(block.text)}
              </p>
            );

          case "quote":
            return (
              <blockquote
                key={index}
                style={{
                  margin: "24px 0",
                  padding: "16px 22px",
                  borderLeft: "4px solid var(--primary)",
                  background: "var(--primary-light)",
                  borderRadius: "0 12px 12px 0",
                  lineHeight: 1.9,
                  overflowWrap: "anywhere",
                }}
              >
                {parseInline(block.text)}
              </blockquote>
            );

          case "unordered-list":
            return (
              <ul
                key={index}
                style={{
                  margin: "0 0 22px",
                  paddingLeft: 26,
                  lineHeight: 1.9,
                  listStyleType: "disc",
                }}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} style={{ marginBottom: 8 }}>
                    {parseInline(item)}
                  </li>
                ))}
              </ul>
            );

          case "ordered-list":
            return (
              <ol
                key={index}
                style={{
                  margin: "0 0 22px",
                  paddingLeft: 26,
                  lineHeight: 1.9,
                  listStyleType: "decimal",
                }}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} style={{ marginBottom: 8 }}>
                    {parseInline(item)}
                  </li>
                ))}
              </ol>
            );

          case "image":
            return (
              <figure key={index} style={{ margin: "24px 0" }}>
                <img
                  src={block.url}
                  alt={block.alt}
                  loading="lazy"
                  style={{
                    display: "block",
                    width: "100%",
                    maxHeight: 560,
                    objectFit: "contain",
                    borderRadius: 14,
                  }}
                />
                {block.alt && (
                  <figcaption
                    style={{
                      marginTop: 8,
                      color: "var(--muted)",
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    {block.alt}
                  </figcaption>
                )}
              </figure>
            );

          case "divider":
            return (
              <hr
                key={index}
                style={{
                  border: 0,
                  borderTop: "1px solid var(--border)",
                  margin: "28px 0",
                }}
              />
            );

          default:
            return null;
        }
      })}

      <style>{`
        .article-markdown a {
          color: var(--primary);
          text-decoration: underline;
          text-underline-offset: 3px;
          overflow-wrap: anywhere;
        }

        .article-markdown code {
          padding: 2px 6px;
          border-radius: 5px;
          background: var(--primary-light);
          font-size: 0.9em;
          overflow-wrap: anywhere;
        }

        .article-markdown img {
          max-width: 100%;
        }

        .article-markdown u {
          text-decoration: underline;
          text-underline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
