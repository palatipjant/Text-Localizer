const path = require('path');

module.exports = {
  mode: 'development',
  entry: './code.ts',
  module: {
    rules: [
      {
        test: /\.html$/,
        use: 'html-loader',
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'code.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
