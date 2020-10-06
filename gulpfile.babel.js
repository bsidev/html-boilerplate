import gulp from 'gulp';
import del from 'del';
import webpackStream from 'webpack-stream';
import named from 'vinyl-named';
import hb from 'gulp-hb';
import plumber from 'gulp-plumber';
import rename from 'gulp-rename';
import beautify from 'gulp-beautify';
import gulpIf from 'gulp-if';
import mediaQueriesSplitter from 'gulp-media-queries-splitter';
import groupCssMediaQueries from 'gulp-group-css-media-queries';
import filter from 'gulp-filter';
import svgMin from 'gulp-svgmin';
import svgStore from 'gulp-svgstore';
import svgSprite from 'gulp-svg-sprite';
import browserSync from 'browser-sync';

import config from './config';

const isProd = process.env.NODE_ENV === 'production';
const isDev = !isProd;
const inputDir = config.inputDir;
const outputDir = config.outputDir;

const clean = () => del([config.outputDir]);

const webpack = () => {
    const cssFilter = filter(['css/main.css'], { restore: true });

    return gulp.src(['src/js/main.js', 'src/styles/main.scss'])
        .pipe(plumber())
        .pipe(named())
        .pipe(webpackStream(require('./webpack.config.js')))
        .pipe(cssFilter)
        .pipe(mediaQueriesSplitter([
            { media: 'none', filename: 'css/main.css' },
            { media: { max: '99999px' }, filename: 'css/media.css' }
        ]))
        .pipe(gulpIf(isProd, groupCssMediaQueries()))
        .pipe(cssFilter.restore)
        .pipe(plumber.stop())
        .pipe(gulp.dest(`./${outputDir}/`))
        .pipe(gulpIf(isDev, browserSync.stream()));
};

const buildPages = () => gulp.src(`./${inputDir}/pages/*.hbs`)
    .pipe(plumber())
    .pipe(hb()
        // Partials
        .partials(`./${inputDir}/pages/partials/**/*.hbs`)
        // Helpers
        .helpers(require('handlebars-helpers'))
        .helpers(require('handlebars-layouts'))
        .helpers(`./${inputDir}/pages/helpers/**/*.js`)
        // Data
        .data(`./${inputDir}/pages/data/**/*.{js,json}`)
        .data({
            publicPath: config.publicPath
        })
    )
    .pipe(gulpIf(isProd, beautify.html(config.htmlBeautify)))
    .pipe(rename({ extname: '.html' }))
    .pipe(plumber.stop())
    .pipe(gulp.dest(`./${outputDir}`))
    .pipe(gulpIf(isDev, browserSync.stream()));

const svgSymbols = () => gulp.src(`./${inputDir}/icons/symbols/**/*.svg`)
    .pipe(plumber())
    .pipe(filter(file => file.stat && file.stat.size))
    .pipe(svgMin({
        plugins: [
            {
                cleanupIDs: {
                    prefix: 'icon-',
                    minify: true
                }
            },
            {
                removeAttrs: { attrs: 'fill' }
            }
        ]
    }))
    .pipe(svgStore())
    .pipe(rename({ basename: 'icons-symbols' }))
    .pipe(gulp.dest(`./${outputDir}/images/`))
    .pipe(gulpIf(isDev, browserSync.stream()));

const svgSprites = () => gulp.src(`./${inputDir}/icons/sprites/**/*.svg`)
    .pipe(plumber())
    .pipe(filter(file => file.stat && file.stat.size))
    .pipe(svgSprite({
        shape: {
            spacing: {
                padding: 2
            }
        },
        mode: {
            css: {
                dest: '.',
                layout: 'horizontal',
                sprite: 'icons-sprite.svg',
                bust: false,
                render: {
                    scss: {
                        dest: '../styles/_svg-icons.scss',
                        template: './src/icons/sprites/svg-template.hbs'
                    }
                },
                common: 'icons'
            }
        }
    }))
    .pipe(gulp.dest(`./src/images/`))
    .pipe(gulpIf(isDev, browserSync.stream()));

const copyStatic = () => gulp.src(`./${inputDir}/static/**/*`)
    .pipe(gulp.dest(`./${outputDir}/static/`))
    .pipe(gulpIf(isDev, browserSync.stream()));

const devServer = () => browserSync.init({
    server: {
        baseDir: `./${outputDir}`
    },
    host: config.devServer.host,
    port: config.devServer.port
});

const watch = () => {
    gulp.watch([`./${inputDir}/styles/**/*.scss`, `./${inputDir}/js/**/*.js`]).on('all', webpack);
    gulp.watch(`./${inputDir}/pages/**/*`).on('all', buildPages);
    gulp.watch(`./${inputDir}/icons/sprites/**/*`).on('all', svgSprites);
    gulp.watch(`./${inputDir}/icons/symbols/**/*`).on('all', svgSymbols);
    gulp.watch(`./${inputDir}/static/**/*`).on('all', copyStatic);
};

export const build = gulp.series(clean, svgSprites, gulp.parallel(webpack, buildPages, svgSymbols, copyStatic));

export const start = gulp.series(build, gulp.parallel(devServer, watch));