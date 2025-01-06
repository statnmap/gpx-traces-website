const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const dotenv = require('dotenv');

dotenv.config();

const gpxFilesDir = process.env.GPX_FILES_DIR || 'gpx-files-real-data';

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
        { from: 'data/traces.json', to: 'data/traces.json' },
        { from: gpxFilesDir, to: gpxFilesDir }
      ]
    })
  ],
  resolve: {
    fallback: {
      stream: false,
      buffer: false,
      timers: false
    }
  }
};
