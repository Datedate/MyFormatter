const parser = require("babylon");
const ast = parser.parse("var a = 100;")
console.log(ast)