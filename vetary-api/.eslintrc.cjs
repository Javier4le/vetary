module.exports = {
	root: true,
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
	},
	env: {
		node: true,
		jest: true,
		es2021: true,
	},
	plugins: ["@typescript-eslint"],
	extends: ["eslint:recommended"],
	ignorePatterns: ["dist", "node_modules", "coverage"],
	rules: {
		"no-unused-vars": "off",
		"@typescript-eslint/no-unused-vars": "off",
		"@typescript-eslint/no-explicit-any": "off",
	},
};
