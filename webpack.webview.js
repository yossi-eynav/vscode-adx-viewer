'use strict';

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

/** @type {import('webpack').Configuration} */
module.exports = {
  target: 'web',
  mode: 'none',
  entry: './src/webview-app/index.tsx',
  output: {
    path: path.resolve(__dirname, 'out/webview'),
    filename: 'webview.js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.webview.json' } }],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/webview-app/dev.html',
      filename: 'index.html',
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ],
  devServer: {
    static: { directory: path.resolve(__dirname, 'out/webview') },
    port: 3000,
    hot: true,
    open: true,
  },
  devtool: 'source-map',
};
