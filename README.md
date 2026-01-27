# scraphand
TypeScript project for ScrapHand v1 (.sh1)

## Structure
This repo has an 'engine' project which has the core language file and a 'vscode' project for the VS Code extension

## To run
Setup your .sh1 file then run this command:

`node engine\dist\cli\cli.js build engine\test\main.sh1

You can override the plugins from your .sh1 file as follows:

`node engine\dist\cli\cli.js build engine\test\main.sh1 --plugins=sh1-docgen,sh1-html,sh1-docx
