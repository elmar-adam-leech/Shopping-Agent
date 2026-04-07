import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import DOMPurify from "dompurify";

export interface MetaobjectFieldData {
  key: string;
  value: string;
  type?: string;
}

export interface MetaobjectData {
  id?: string;
  type?: string;
  handle?: string;
  displayName?: string;
  fields?: MetaobjectFieldData[];
  _layoutHint?: "faq" | "size_guide" | "rich_text";
}

function inferLayout(data: MetaobjectData): "faq" | "size_guide" | "rich_text" {
  if (data._layoutHint) return data._layoutHint;
  const typeStr = (data.type || data.handle || "").toLowerCase();
  if (typeStr.includes("faq") || typeStr.includes("question")) return "faq";
  if (typeStr.includes("size") || typeStr.includes("guide") || typeStr.includes("chart")) return "size_guide";
  return "rich_text";
}

function FAQAccordion({ fields }: { fields: MetaobjectFieldData[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const pairs: { question: string; answer: string }[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const key = f.key.toLowerCase();
    if (key.includes("question") || key.includes("title") || key === "q") {
      const answerField = fields.find(
        (af) =>
          af !== f &&
          (af.key.toLowerCase().includes("answer") ||
            af.key.toLowerCase().includes("body") ||
            af.key.toLowerCase().includes("content") ||
            af.key.toLowerCase() === "a") &&
          !pairs.some((p) => p.answer === af.value)
      );
      pairs.push({ question: f.value, answer: answerField?.value || "" });
    }
  }

  if (pairs.length === 0) {
    for (let i = 0; i < fields.length - 1; i += 2) {
      pairs.push({ question: fields[i].value, answer: fields[i + 1]?.value || "" });
    }
  }

  if (pairs.length === 0) return <RichTextLayout fields={fields} />;

  return (
    <div className="space-y-1">
      {pairs.map((pair, i) => (
        <div key={i} className="border border-border/30 rounded-lg overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between p-2.5 text-left text-xs font-medium hover:bg-muted/30 transition-colors"
          >
            <span>{pair.question}</span>
            {openIndex === i ? (
              <ChevronUp className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
            )}
          </button>
          {openIndex === i && (
            <div className="px-2.5 pb-2.5 text-xs text-muted-foreground leading-relaxed border-t border-border/20 pt-2">
              {pair.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SizeGuideTable({ fields }: { fields: MetaobjectFieldData[] }) {
  const tableFields = fields.filter((f) => {
    const k = f.key.toLowerCase();
    return !k.includes("title") && !k.includes("name") && !k.includes("handle") && f.value;
  });

  if (tableFields.length === 0) return <RichTextLayout fields={fields} />;

  let parsedRows: Record<string, string>[] | null = null;
  for (const f of tableFields) {
    try {
      const parsed = JSON.parse(f.value);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
        parsedRows = parsed;
        break;
      }
    } catch {}
  }

  if (parsedRows && parsedRows.length > 0) {
    const headers = Object.keys(parsedRows[0]);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="border border-border/40 bg-muted/30 px-2 py-1.5 text-left font-semibold capitalize"
                >
                  {h.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsedRows.map((row, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td key={h} className="border border-border/40 px-2 py-1.5">
                    {String(row[h] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="border border-border/40 bg-muted/30 px-2 py-1.5 text-left font-semibold">Property</th>
            <th className="border border-border/40 bg-muted/30 px-2 py-1.5 text-left font-semibold">Value</th>
          </tr>
        </thead>
        <tbody>
          {tableFields.map((f, i) => (
            <tr key={i}>
              <td className="border border-border/40 px-2 py-1.5 font-medium capitalize">
                {f.key.replace(/_/g, " ")}
              </td>
              <td className="border border-border/40 px-2 py-1.5">{f.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RichTextField({ field, isHtml }: { field: MetaobjectFieldData; isHtml: boolean }) {
  const sanitizedHtml = useMemo(
    () => (isHtml ? DOMPurify.sanitize(field.value) : ""),
    [field.value, isHtml]
  );

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-0.5">
        {field.key.replace(/_/g, " ")}
      </p>
      {isHtml ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed [&_a]:text-primary"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      ) : (
        <p className="text-xs text-foreground/90 whitespace-pre-wrap">{field.value}</p>
      )}
    </div>
  );
}

function RichTextLayout({ fields }: { fields: MetaobjectFieldData[] }) {
  const contentFields = fields.filter((f) => {
    const k = f.key.toLowerCase();
    return !k.includes("handle") && !k.includes("id") && f.value;
  });

  return (
    <div className="space-y-2">
      {contentFields.map((f, i) => {
        const isHtml =
          f.type === "rich_text_field" ||
          f.type === "multi_line_text_field" ||
          /<[a-z][\s\S]*>/i.test(f.value);
        return (
          <RichTextField key={i} field={f} isHtml={isHtml} />
        );
      })}
    </div>
  );
}

export function MetaobjectCard({ data }: { data: MetaobjectData }) {
  const layout = inferLayout(data);
  const title =
    data.displayName ||
    data.fields?.find((f) => f.key === "title" || f.key === "name")?.value ||
    data.type?.replace(/_/g, " ");
  const fields = data.fields || [];

  return (
    <div className="bg-card border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-colors p-3">
      {title && (
        <h4 className="font-semibold text-sm mb-2 capitalize">{title}</h4>
      )}
      {layout === "faq" && <FAQAccordion fields={fields} />}
      {layout === "size_guide" && <SizeGuideTable fields={fields} />}
      {layout === "rich_text" && <RichTextLayout fields={fields} />}
    </div>
  );
}
