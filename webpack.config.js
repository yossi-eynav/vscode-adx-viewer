'use strict';

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'node_modules/chart.js/dist/chart.umd.min.js'),
          to: path.resolve(__dirname, 'media/chart.min.js'),
        },
      ],
    }),
  ],
  devtool: 'source-map',
  infrastructureLogging: {
    level: 'log',
  },
};

/** @type {import('webpack').Configuration} */
const webviewConfig = {
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
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ],
  devtool: 'source-map',
};

module.exports = [extensionConfig, webviewConfig];
