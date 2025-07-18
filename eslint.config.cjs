const promisePlugin = require('eslint-plugin-promise');
const { generateEslintConfigs } = require('@ti-platform/aide-build-tools');

module.exports = generateEslintConfigs({
	baseDir: __dirname,
	enable: ['cjs', 'json', 'ts'],
	configureTs: (configs) => {
		return {
			...configs,
			plugins: {
				...configs.plugins,
				promise: promisePlugin,
			},
			rules: {
				...configs.rules,
				...promisePlugin.configs.recommended.rules,
			},
		};
	},
});
