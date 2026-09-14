const { merge } = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
module.exports = merge(require('./webpack.common'), {
    mode: 'production', devtool: false, output: { publicPath: '/' },
    optimization: { minimize: true, minimizer: [new TerserPlugin({ parallel: false, extractComments: false })] },
    plugins: [new WorkboxPlugin.GenerateSW({ clientsClaim: true, skipWaiting: true })],
});
