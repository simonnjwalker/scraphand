// src/dev-test.ts

// If your index.ts re-exports parse/tokenize, you can instead do:
//   import { parse, tokenize } from "./index";
import { lex } from "./core/lexer";
import { parse } from "./core/parser";

const source = `
An overview of political philosophy /// This is a comment which is stripped-out

/*
    this block comment is also stripped out
*/

According to {surname:Rawls1971}, the just society is one that provides a minimal set of health, education, and welfare to give all citizens sufficient opportunity to thrive in the pursuit of their life projects {inline:Rawls1971 p 31}.


{{

 \\{sometext}

// this should not be removed

}}
`;

console.log("===== SOURCE =====");
console.log(source);

console.log("\n===== TOKENS =====");
const tokens = lex(source);
console.dir(tokens, { depth: null });

console.log("\n===== AST =====");
const ast = parse(source);
console.dir(ast, { depth: null });
