function parseInline(text) {
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`${match.index}-b`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={`${match.index}-c`} className="rounded bg-slate-100 px-1 py-0.5 text-slate-800">{token.slice(1, -1)}</code>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function renderTable(lines, startIndex) {
  const rows = [];
  let index = startIndex;
  while (index < lines.length && lines[index].trim().startsWith("|")) {
    rows.push(lines[index]);
    index += 1;
  }
  const usableRows = rows.filter((row) => !/^\|\s*-+/.test(row.trim()));
  const [header, ...body] = usableRows.map((row) =>
    row
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim()),
  );
  return {
    nextIndex: index,
    node: (
      <div key={`table-${startIndex}`} className="overflow-x-auto">
        <table className="min-w-full border border-slate-200 text-sm">
          <thead className="bg-slate-100">
            <tr>
              {(header || []).map((cell, cellIndex) => (
                <th key={cellIndex} className="border border-slate-200 px-3 py-2 text-left font-semibold">
                  {parseInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-white even:bg-slate-50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border border-slate-200 px-3 py-2 align-top">
                    {parseInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  };
}

export default function MarkdownGuide({ content }) {
  const lines = content.split(/\r?\n/);
  const nodes = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }
    if (trimmed.startsWith("|")) {
      const table = renderTable(lines, index);
      nodes.push(table.node);
      index = table.nextIndex;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      nodes.push(<h1 key={index} className="text-3xl font-bold text-slate-950">{parseInline(trimmed.slice(2))}</h1>);
    } else if (trimmed.startsWith("## ")) {
      nodes.push(<h2 key={index} className="mt-8 text-xl font-semibold text-slate-900">{parseInline(trimmed.slice(3))}</h2>);
    } else if (trimmed.startsWith("### ")) {
      nodes.push(<h3 key={index} className="mt-5 text-base font-semibold text-slate-800">{parseInline(trimmed.slice(4))}</h3>);
    } else if (trimmed.startsWith("- ")) {
      const items = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      nodes.push(
        <ul key={`ul-${index}`} className="list-disc space-y-1 pl-6 text-slate-700">
          {items.map((item, itemIndex) => <li key={itemIndex}>{parseInline(item)}</li>)}
        </ul>,
      );
      continue;
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      nodes.push(
        <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-6 text-slate-700">
          {items.map((item, itemIndex) => <li key={itemIndex}>{parseInline(item)}</li>)}
        </ol>,
      );
      continue;
    } else if (trimmed.startsWith("> ")) {
      nodes.push(<blockquote key={index} className="border-l-4 border-blue-300 bg-blue-50 px-4 py-2 text-slate-700">{parseInline(trimmed.slice(2))}</blockquote>);
    } else if (trimmed.startsWith("```")) {
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      nodes.push(<pre key={`code-${index}`} className="overflow-x-auto rounded bg-slate-950 p-4 text-sm text-slate-50"><code>{code.join("\n")}</code></pre>);
    } else {
      nodes.push(<p key={index} className="leading-7 text-slate-700">{parseInline(trimmed)}</p>);
    }
    index += 1;
  }

  return <article className="space-y-4">{nodes}</article>;
}
