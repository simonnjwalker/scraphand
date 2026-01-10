export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "citation"; key: string }
  | { kind: "image"; assetId: string; alt?: string };

export type Block =
  | { kind: "paragraph"; inlines: Inline[] }
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; inlines: Inline[] }
  | { kind: "codeBlock"; text: string; language?: string }
  | { kind: "raw"; text: string }; // fallback when you want to preserve unknown content

export interface DocumentIR {
  blocks: Block[];
}
