// Configuracao do Stryker (Teste de Mutacao - preparada para a Fase 3).
// Execute com: npm run test:mutation
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
module.exports = {
  packageManager: 'npm',
  testRunner: 'jest',
  jest: { projectType: 'custom', configFile: 'package.json' },
  reporters: ['html', 'clear-text', 'progress'],
  coverageAnalysis: 'perTest',
  mutate: [
    'src/services/**/*.js',
    'src/domain/**/*.js',
    '!src/server.js',
  ],
  thresholds: { high: 90, low: 80, break: 80 },
};
