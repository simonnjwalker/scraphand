export type BlockType =
  | "bibtex"
  | "csl-json"
  | "latex"
  | "typst"
  | "markdown"
  | "html"
  | "text"
  | "unknown";

export interface DetectedBlock {
  type: BlockType;
  confidence: number; // 0..1
  reason: string;
}

function firstNonEmptyLine(s: string): string {
  for (const line of s.split("\n")) {
    const t = line.trim();
    if (t.length) return t;
  }
  return "";
}

export function normaliseText(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

export function detectBlockType(content: string): DetectedBlock {
  const text = normaliseText(content).trim();
  if (!text) return { type: "text", confidence: 1, reason: "empty block" };

  const first = firstNonEmptyLine(text);

  // BibTeX (very strong signals)
  if (/^@\w+\s*\{/.test(first)) {
    return { type: "bibtex", confidence: 0.95, reason: "starts with @type{...}" };
  }

  // CSL-JSON (heuristic: looks like JSON and contains CSL keys)
  if ((first.startsWith("{") || first.startsWith("[")) && /"issued"|"author"|"title"/.test(text)) {
    return { type: "csl-json", confidence: 0.7, reason: "JSON-like with CSL-ish keys" };
  }

  // LaTeX (strong-ish signals)
  if (
    /\\(begin|end)\{/.test(text) ||
    /\\(section|subsection|textbf|textit|cite)\b/.test(text) ||
    (first.startsWith("$") && text.endsWith("$"))
  ) {
    return { type: "latex", confidence: 0.7, reason: "LaTeX control sequences detected" };
  }

   // LaTeX / TeX (stronger signals; score-based)
  {
    let score = 0;
    const reasons: string[] = [];

    // 1) Environments: align/equation/array/tabular/itemize/etc.
    if (/\\(begin|end)\{(equation|align|aligned|gather|multline|array|tabular|matrix|pmatrix|bmatrix|vmatrix|cases|itemize|enumerate|figure|table|thebibliography|tikzpicture)\}/.test(text)) {
      score += 3; reasons.push("common LaTeX environment");
    }

    // 2) Display math delimiters: \[ ... \]
    if (/\\\[[\s\S]*\\\]/.test(text)) {
      score += 3; reasons.push("\\[...\\] display math");
    }

    // 3) Inline math delimiters: \( ... \)
    if (/\\\([\s\S]*\\\)/.test(text)) {
      score += 2; reasons.push("\\(...\\) inline math");
    }

    // 4) $$ ... $$ display math
    if (/^\s*\$\$[\s\S]*\$\$\s*$/.test(text)) {
      score += 3; reasons.push("$$...$$ display math");
    }

    // 5) Preamble signals: \documentclass, \usepackage, \newcommand, \DeclareMathOperator
    if (/\\(documentclass|usepackage|newcommand|renewcommand|providecommand|DeclareMathOperator)\b/.test(text)) {
      score += 3; reasons.push("preamble-style commands");
    }

    // 6) Common math commands: \frac \sum \int \sqrt \left \right \mathrm \mathbf etc
    if (/\\(frac|dfrac|tfrac|sum|prod|int|iint|iiint|oint|sqrt|left|right|cdot|times|pm|mp|leq|geq|neq|approx|equiv|to|mapsto|infty|partial|nabla|mathrm|mathbf|mathit|mathbb|mathcal|text)\b/.test(text)) {
      score += 2; reasons.push("common math commands");
    }

    // 7) Greek letters / symbols: \alpha \beta \Gamma ...
    if (/\\(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)\b/.test(text)) {
      score += 2; reasons.push("Greek letter commands");
    }

    // 8) Alignment marker '&' in a math-ish context (avoid plain tables)
    if (/[^\S\r\n]*&[^\S\r\n]*=/.test(text) || /\\begin\{align/.test(text)) {
      score += 2; reasons.push("alignment markers (&, &=)");
    }

    // 9) Sub/superscripts in math-ish context (avoid normal prose with underscores)
    // Only count if there is also at least one backslash command OR dollar delimiters.
    if ((/[_^]/.test(text)) && (/[\\]/.test(text) || /\$/.test(text))) {
      score += 1; reasons.push("math subscripts/superscripts");
    }

    // 10) Comment lines starting with % (common in LaTeX)
    if (/(^|\n)\s*%/.test(text)) {
      score += 1; reasons.push("LaTeX comment (%)");
    }

    // Keep your existing “strong-ish” signals too:
    if (/\\(section|subsection|textbf|textit|cite|label|ref|pageref)\b/.test(text)) {
      score += 2; reasons.push("LaTeX document commands");
    }
    if (first.startsWith("$") && text.endsWith("$")) {
      score += 2; reasons.push("$...$ math-ish");
    }

    if (score >= 4) {
      const confidence = Math.min(0.95, 0.55 + score * 0.08);
      return { type: "latex", confidence, reason: reasons.join("; ") };
    }
  }



  // Typst (light heuristic — you’ll refine later)
  if (/^#(set|show|import)\b/.test(first) || /\btypst\b/i.test(first)) {
    return { type: "typst", confidence: 0.55, reason: "typst-ish directives" };
  }

  // Markdown
  if (/^(#{1,6}\s+|- |\* |\d+\.\s+)/.test(first) || /```/.test(text)) {
    return { type: "markdown", confidence: 0.6, reason: "markdown markers detected" };
  }

  // HTML
  if (/^<([a-z][a-z0-9]*)\b/i.test(first)) {
    return { type: "html", confidence: 0.6, reason: "looks like an HTML tag" };
  }

  return { type: "unknown", confidence: 0.2, reason: "no known patterns matched" };
}
