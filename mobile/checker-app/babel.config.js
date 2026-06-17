module.exports = function (api) {
  if (api.env('test')) {
    return {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
      ],
    };
  }
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin MUST be last (Reanimated 4.x requirement)
    plugins: ['react-native-worklets/plugin'],
  };
};
