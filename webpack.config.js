const path = require('path');
const cssnano = require('cssnano');
const { argv } = require('yargs');
const globImporter = require('node-sass-glob-importer');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ImageminPlugin = require('imagemin-webpack-plugin').default;
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const cacheDir = path.resolve(__dirname, 'node_modules', '.cache', 'cache-loader');

const isProd = !!argv.production;

const getThreadLoader = name => ({
    loader: 'thread-loader',
    options: {
        workerParallelJobs: 50,
        poolRespawn: false,
        name
    }
});

const webpackConfig = {
    mode: isProd ? 'production' : 'development',
    output: {
        filename: 'js/[name].js'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'cache-loader',
                        options: {
                            cacheDirectory: path.resolve(cacheDir, 'js')
                        }
                    },
                    getThreadLoader('js'),
                    {
                        loader: 'babel-loader',
                        options: {
                            cacheDirectory: path.resolve(cacheDir, 'babel')
                        }
                    }
                ]
            },
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'cache-loader',
                        options: {
                            cacheDirectory: path.resolve(cacheDir, 'css')
                        }
                    },
                    'css-loader',
                    'postcss-loader'
                ]
            },
            {
                test: /\.s[ac]ss$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'cache-loader',
                        options: {
                            cacheDirectory: path.resolve(cacheDir, 'scss')
                        }
                    },
                    'css-loader',
                    'postcss-loader',
                    {
                        loader: 'sass-loader',
                        options: {
                            sassOptions: {
                                importer: globImporter()
                            }
                        }
                    }
                ]
            },
            {
                test: /\.(woff2?|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: '/fonts/'
                        }
                    }
                ]
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: '/images/'
                        }
                    }
                ]
            }
        ]
    },
    optimization: {
        minimizer: [
            new TerserPlugin({
                cache: true,
                extractComments: false
            })
        ],
        splitChunks: {
            cacheGroups: {
                commons: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendor',
                    chunks: 'all'
                }
            }
        }
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: 'css/[name].css',
            chunkFilename: 'css/[name].css'
        })
    ]
};

if (isProd) {
    webpackConfig.optimization.minimize = true;
    // noinspection JSCheckFunctionSignatures
    webpackConfig.plugins.push(...[
        new OptimizeCssAssetsPlugin({
            assetNameRegExp: /\.css$/g,
            cssProcessor: cssnano,
            cssProcessorOptions: { discardComments: { removeAll: true } },
            canPrint: true
        }),
        new ImageminPlugin()
    ]);
} else {
    webpackConfig.devtool = 'cheap-eval-source-map';
}

module.exports = webpackConfig;
