module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-react',
    '@babel/preset-typescript',
  ],
  // Only apply to test files to avoid Next.js font loading conflicts
  test: /\.test\.(ts|tsx|js|jsx)$/,
  plugins: [],
};
