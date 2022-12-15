//const { variableDeclaration } = require("babel-types");
const parser = require("babylon");
const {
  doc: {
    builders: { concat, hardline, group, indent, softline, join, line },
  },
  util,
} = require("prettier");

const languages = [
  {
    extensions: [".sql"],
    name: "sql",
    parsers: ["sql-parse"],
  },
];

const parsers = {
  "sql-parse": {
    parse: (text) => parser.parse(text),
    astFormat: "sql-ast",
  },
};

function getLastStatement(statements) {
	console.log(statements);
	for (let i = statements.length - 1; i >= 0; i--) {
		const statement = statements[i];
		console.log(statement);
		if (statement.type !== "EmptyStatement") {
			return statement;
		}
	}
}

function printBody(path, options, print)
{
	console.log("---- printBody ----");
	const node = path.getValue();
	const parts = [];
	const lastStatement = getLastStatement(node["body"]);

	path.each((path, index, statements) => {
		const node = path.getValue();
		if (node.type === "EmptyStatement") {
		  return;
		}
		console.log(node);
		const printed = print();
		//console.log(options);
		// // in no-semi mode, prepend statement with semicolon if it might break ASI
		// // don't prepend the only JSX element in a program with semicolon
		if (!options.semi && statementNeedsASIProtection(path, options)) {
			if (hasComment(node, CommentCheckFlags.Leading)) {
				parts.push(print([], { needsSemi: true }));
			} else {
				parts.push(";", printed);
			}
		} else {
			parts.push(printed);
		}

		if (!options.semi && isClassProperty(node) &&
		  // `ClassBody` don't allow `EmptyStatement`,
		  // so we can use `statements` to get next node
		  shouldPrintSemicolonAfterClassProperty(node, statements[index + 1])
		) {
		  parts.push(";");
		}
	
		if (node !== lastStatement) {
			parts.push(hardline);
			if (isNextLineEmpty(node, options)) {
				parts.push(hardline);
			}
		}

	}, "body");
	console.log(parts);
	return "";
}

function printBlockBody(path, options, print)
{
	console.log("--printBlockBody--");
	const node = path.getValue();
	const nodeHasBody = node.body.some((node) => node.type !== "EmptyStatement");	// nodeのbody内が空じゃないかどうか
	const parts = [];
	if (nodeHasBody) {
		parts.push(printBody(path, options, print));
	}

	if (node.type === "Program") {
		const parent = path.getParentNode();
		if (!parent || parent.type !== "ModuleExpression") {
			parts.push(hardline);
		}
	}

	return parts;
}

// 代入式かどうか
function isAssignment(node) {
	return node.type === "AssignmentExpression";
}

// 代入式か変数の宣言子かどうか
function isAssignmentOrVariableDeclator(node){
	return isAssignment(node) || node.type === "VariableDeclator";
}

function chooseLayout(path, options, print, leftDoc, rightPropertyName)
{
	const node = path.getValue();
	const rightNode = node[rightPropertyName];
	console.log("----chooselayout----");
	console.log(leftDoc);
	console.log(rightNode);
	if (!rightNode) {
	  return "only-left";
	}


	const isTail = !isAssignment(rightNode);	// 代入が続いているかどうか(falseだと→	const a = b = c;)
	const shouldUseChainFormating = path.match(isAssignment, isAssignmentOrVariableDeclator,
		(node)=>{
			// 代入が続いていない or (普通の式じゃない and 変数宣言じゃない)
			return !isTail || (node.type !== "ExpressionStatement" && node.type !== "VariableDeclation")
		}
	);

	if (shouldUseChainFormating){

		if (!isTail){
			// a = b = c;のような普通のチェイン
			return "chain";	
		}
		else{

			// var foo = (bar) => {}
			if (rightNode.type === "ArrowFunctionExpression"
			&& rightNode.body.type === "ArrowFunctionExpression"){
				return "chain-tail-arrow-chain";
			}
			else{
				return "chain-tail";
			}
		}
	}

	const isHeadOfLongChain = !isTail && isAssignment(rightNode.right);
	if (isHeadOfLongChain || hasLeadingOwnLineComment(options.originalText, rightNode))
	{
		return "break-after-operator";
	}
	
	return "only-left";
}

function printAssignment(path, options, print, leftDoc, operator, rightPropertyName)
{
	console.log("-----printAssignment-----");
	const layout = chooseLayout(path, options, print, leftDoc, rightPropertyName);
	//console.log(rightPropertyName);
	//const rightDoc = print(rightPropertyName, {assignmentLayout: layout});

	// switch(layout){
	// 	case 
	// }
	return leftDoc;
}

function printVariableDeclarator(path, options, print)
{
	
	return printAssignment(path, options, print, print("id"), " =", "init");
}

function printSQL(path, options, print) {
	console.log("==printSQL==");
  const node = path.getValue();
  if (Array.isArray(node)) {
    return concat(path.map(print));
  }
  console.log(node);

  let parts = [];
  switch (node.type) {
	case 'File':
		if (node.program && node.program.interpreter) {
			parts.push(print(["program", "interpreter"]));
		}
	
		parts.push(print("program"));
	
		return parts;
	case "Program":
		return printBlockBody(path, options, print);
	case "VariableDeclaration":	// var, let, constなどの変数宣言
		const printed = path.map(print, "declarations");
		// const parentNode = path.getParentNode();
		// const isParentForLoop = parentNode.type == "ForStatement" ||		// for (var i = 0; i < 10; i++)
		// 						parentNode.type == "ForInStatement" ||		// for (var obj in list )
		// 						parentNode.type == "ForOfStatement";		// for (var value of array)
		// const hasValue = node.declarations.some((decl) => decl.init);


		return;
	case "VariableDeclarator":
		return printVariableDeclarator(path, options, print);
    default:
      return "";
  }
}



const printers = {
  "sql-ast": {
    print: printSQL,
  },
};

module.exports = {
  languages,
  parsers,
  printers,
};