module.exports = function (api) {
  api.cache(true);
  if (api.env('test')) {
    return {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
      ],
    };
  }
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin MUST be last (Reanimated 4.x requirement)
    plugins: ['react-native-worklets/plugin'],
  };
};
