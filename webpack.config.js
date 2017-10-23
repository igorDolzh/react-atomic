let path = require('path')
let webpack = require('webpack')

let plugins =
  process.env.NODE_ENV === 'production' ?
  [
    new webpack.optimize.ModuleConcatenationPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      minify: true,
      beautify: false
    })
  ] :
  [
    new webpack.optimize.UglifyJsPlugin({
      minify: false,
      beautify: true
    })
  ]

module.exports = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: process.env.NODE_ENV === 'production' ? 'atomic.min.js' : 'atomic.js',
    libraryTarget: 'umd'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader'],
        include: [
          /src\/.*/
        ]
      }
    ]
  },
}