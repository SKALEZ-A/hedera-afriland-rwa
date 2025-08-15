module.exports = {
  presets: [
    'module:metro-react-native-babel-preset',
    '@babel/preset-typescript',
  ],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@services': './src/services',
          '@utils': './src/utils',
          '@types': './src/types',
          '@contexts': './src/contexts',
          '@navigation': './src/navigation',
          '@config': './src/config',
        },
      },
    ],
    'react-native-reanimated/plugin', // This should be last
  ],
};