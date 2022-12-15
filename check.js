const prettier = require("prettier");
const format = (code) => {
  const res = prettier.format(code, {
    parser: "sql-parse",
    plugins: ["."],
  });
  return res;
};
console.log(format("var a = 1000;"));