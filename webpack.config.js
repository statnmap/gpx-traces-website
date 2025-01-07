const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const dotenv = require('dotenv');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

dotenv.config();

const gpxFilesDir = process.env.GPX_FILES_DIR || 'gpx-files-real-data';
const tracesFilePath = process.env.TRACES_FILE_PATH || 'traces-real/traces.json';

module.exports = {
  entry: './scripts/map.js',
  mode: 'production',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'index.html', to: 'index.html' },
        { from: 'styles.css', to: 'styles.css' },
        { from: tracesFilePath, to: tracesFilePath },
        { from: gpxFilesDir, to: gpxFilesDir }
      ]
    }),
    new webpack.DefinePlugin({
      'process.env': JSON.stringify({
        GPX_FILES_DIR: process.env.GPX_FILES_DIR,
        TRACES_FILE_PATH: process.env.TRACES_FILE_PATH
      })
    })
  ],
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()]
  },
  resolve: {
    fallback: {
      stream: false,
      buffer: false,
      timers: false
    }
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 9000,
    hot: true,
    open: true,
    historyApiFallback: true
  }
};
