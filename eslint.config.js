// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'scripts/*'],
  },
  {
    // Règles du compilateur React : elles prennent les valeurs partagées de Reanimated
    // (`progress.value = withTiming(…)`) pour des mutations interdites. C'est le fonctionnement
    // normal de Reanimated : signalées en avertissement, sans toucher au code des animations.
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/globals': 'warn',
    },
  },
]);
