import katex from "katex";
import "katex/dist/katex.min.css";
import { splitMathSegments } from "@/lib/math/segments";

/**
 * Safe math rendering. Plain text is rendered as React text (escaped). Only
 * KaTeX output, generated with trust:false, is injected as HTML.
 */
export function MathText({ children }: { children: string }) {
  return (
    <>
      {splitMathSegments(children).map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.value}</span>;
        const html = katex.renderToString(seg.value, {
          displayMode: seg.display,
          throwOnError: false,
          trust: false,
          strict: "ignore",
          output: "htmlAndMathml",
        });
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </>
  );
}
