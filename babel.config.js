module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-react',
    '@babel/preset-typescript',
  ],
  plugins: [
    // Add support for TypeScript syntax that might be confused with Flow
    '@babel/plugin-syntax-typescript',
  ],
};
