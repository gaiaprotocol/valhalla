const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: './app/main.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, process.env.NODE_ENV === 'production' ? './public' : './public-dev')
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
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader, {
            loader: "css-loader",
            options: {
              url: false,
            },
          }
        ]
      },
      {
        test: /\.ya?ml$/,
        use: "yaml-loader",
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset', // 100kb 이하면 자동으로 base64 인라인, 크면 파일로
        parser: {
          dataUrlCondition: {
            maxSize: 100 * 1024 // 100kb
          }
        }
      },
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@tanstack/react-query': path.resolve(__dirname, 'node_modules/@tanstack/react-query'),
    },
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: 'styles.css' }),
    new webpack.DefinePlugin({
      GAIA_API_BASE_URI: JSON.stringify(
        process.env.NODE_ENV === 'production'
          ? 'https://api.gaia.cc'
          : 'http://localhost:8080'
      ),
      API_BASE_URI: JSON.stringify(
        process.env.NODE_ENV === 'production'
          ? 'https://valhalla.gaia.cc/api'
          : 'http://localhost:8081/api'
      ),
      APP_NAME: JSON.stringify('Valhalla'),
      WALLET_CONNECT_PROJECT_ID: JSON.stringify('9a637488c787c2c68339c70e1319ac6a'),
    })
  ],
  mode: 'development'
};
