const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: './app/main.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, './public')
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.app.json',
          }
        },
        exclude: /node_modules/
      },
      {
        test: /\.less$/,
        use: [
          MiniCssExtractPlugin.loader, {
            loader: "css-loader",
            options: {
              url: false,
            },
          },
          'less-loader'
        ]
      },
      {
        test: /\.ya?ml$/,
        use: "yaml-loader",
      },
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
    new MiniCssExtractPlugin({ filename: 'styles.css' })
  ],
  mode: 'development'
};
