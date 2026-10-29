export interface MathTool {
  id: string;
  name: string;
  description: string;
  href: string;
  /** External tools open in a new tab. Embedded tools are not supported yet. */
  external: boolean;
}

/**
 * Registry of math utilities. Add entries here to extend the Math Tools page.
 * Whether a tool may be used during a given exam is NOT enforced yet
 * (mock_exams.external_tools_allowed is stored but not applied).
 */
export const MATH_TOOLS: readonly MathTool[] = [
  {
    id: "desmos-graphing",
    name: "Desmos Graphing Calculator",
    description: "Plot functions, explore transformations and visualise equations.",
    href: "https://www.desmos.com/calculator",
    external: true,
  },
];
