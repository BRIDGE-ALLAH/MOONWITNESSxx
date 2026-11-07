const unsafeSvgRules = [
  {
    pattern: /<(?:script|foreignObject|iframe|object|embed)\b/i,
    message: "active or embedded SVG elements are not allowed",
  },
  {
    pattern: /<!DOCTYPE\b|<!ENTITY\b/i,
    message: "DTD and entity declarations are not allowed",
  },
  {
    pattern: /\bon[a-z][\w:-]*\s*=|javascript\s*:/i,
    message: "inline event handlers and JavaScript URLs are not allowed",
  },
  {
    pattern: /\b(?:href|xlink:href|src)\s*=\s*["']\s*(?!#)[^"']*["']/i,
    message: "resource attributes may only reference local SVG fragments",
  },
  {
    pattern: /url\(\s*(?:["']\s*)?(?!#)[^)]+\)/i,
    message: "CSS url() may only reference local SVG fragments",
  },
  {
    pattern: /@import\b/i,
    message: "CSS @import is not allowed in registered SVG assets",
  },
] as const;

export function inspectSvgSafety(svg: string): string[] {
  return unsafeSvgRules
    .filter(({ pattern }) => pattern.test(svg))
    .map(({ message }) => message);
}
