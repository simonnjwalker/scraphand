// src/dev-demo.ts
import { parse } from "./index";

const source = `
\\title{My first doc}
Hello world!
`;

const doc = parse(source);

console.log(JSON.stringify(doc, null, 2));
