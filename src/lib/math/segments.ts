export type MathSegment = { type: "text" | "math"; value: string; display: boolean };

/**
 * Splits text into plain and LaTeX segments. Supports $...$ (inline) and
 * $$...$$ (display). A lone "$" with no closing delimiter stays plain text.
 * Pure function so it can be unit-tested; rendering happens in <MathText />.
 */
export function splitMathSegments(input: string): MathSegment[] {
  const segments: MathSegment[] = [];
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  for (const match of input.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: "text", value: input.slice(last, index), display: false });
    const display = match[1] !== undefined;
    segments.push({ type: "math", value: (match[1] ?? match[2]) as string, display });
    last = index + match[0].length;
  }
  if (last < input.length) segments.push({ type: "text", value: input.slice(last), display: false });
  return segments;
}
