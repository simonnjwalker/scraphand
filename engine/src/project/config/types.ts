export type ConfigValue =
  | string
  | number
  | boolean
  | null
  | ConfigObject
  | ConfigValue[];

export interface ConfigObject {
  [key: string]: ConfigValue;
}

export type ConfigOp = "=" | "+=" | "-=" | "!=";

export interface ConfigAssignment {
  path: string[]; // e.g. ["bibliography","style"]
  op: ConfigOp;
  value?: ConfigValue; // optional for "!=" reset-without-value
}

/**
 * Your compiled configuration object.
 * Keep it loose initially; tighten later if you want.
 */
export type ScraphandConfig = ConfigObject;
