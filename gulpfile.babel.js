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
import imagemin from 'gulp-imagemin';
import tap from 'gulp-tap';
import merge from 'merge-stream';
import inject from 'gulp-inject';
import browserSync from 'browser-sync';
import { argv } from 'yargs';

import fs from 'fs';
import path from 'path';

import config from './config';

const isProd = !!argv.production;
const isDev = !isProd;
const inputDir = config.inputDir;
const outputDir = config.outputDir;

const clean = () => del([config.outputDir]);

const webpack = () => {
    const mainCssFilter = filter(['css/main.css'], { restore: true });

    return gulp.src([`./${inputDir}/js/main.js`, `./${inputDir}/styles/main.scss`])
        .pipe(plumber())
        .pipe(named())
        .pipe(webpackStream(require('./webpack.config.js')))
        .pipe(mainCssFilter)
        .pipe(mediaQueriesSplitter([
            { media: 'none', filename: 'css/main.css' },
            { media: { max: '99999px' }, filename: 'css/media.css' }
        ]))
        .pipe(gulpIf(isProd, groupCssMediaQueries()))
        .pipe(mainCssFilter.restore)
        .pipe(plumber.stop())
        .pipe(gulp.dest(`./${outputDir}/`))
        .pipe(gulpIf(isDev, browserSync.stream()));
};

const buildPages = () => gulp.src(`./${inputDir}/*.hbs`)
    .pipe(plumber())
    .pipe(hb()
        // Partials
        .partials(`./${inputDir}/partials/**/*.hbs`)
        // Helpers
        .helpers(require('handlebars-helpers'))
        .helpers(require('handlebars-layouts'))
        .helpers(`./${inputDir}/helpers/**/*.js`)
        // Data
        .data(`./${inputDir}/data/**/*.{js,json}`)
        .data({
            publicPath: config.publicPath
        })
    )
    .pipe(gulpIf(isProd, beautify.html(config.htmlBeautify)))
    .pipe(rename({ extname: '.html' }))
    .pipe(plumber.stop())
    .pipe(gulp.dest(`./${outputDir}`))
    .pipe(gulpIf(isDev, browserSync.stream()));

const svgSymbols = () => {
    return gulp.src(`./${inputDir}/icons/symbols/**/*.svg`)
        .pipe(plumber())
        .pipe(filter(file => file.stat && file.stat.size))
        .pipe(svgMin({
            plugins: [
                { cleanupIDs: { minify: true } },
                { removeAttrs: { attrs: 'fill' } }
            ]
        }))
        .pipe(svgStore())
        .pipe(rename({ basename: 'icons-symbols' }))
        .pipe(gulp.dest(`./${outputDir}/images/`))
        .pipe(gulpIf(isDev, browserSync.stream()));
};

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
                        dest: `../styles/_svg-icons.scss`,
                        template: `./${inputDir}/icons/sprites/svg-template.hbs`
                    }
                },
                common: 'icons'
            }
        }
    }))
    .pipe(gulp.dest(`./${inputDir}/images/`))
    .pipe(gulpIf(isDev, browserSync.stream()));

const copyImages = () => gulp.src([`./${inputDir}/images/**/*`, `!./${inputDir}/images/icons-*.svg`])
    .pipe(gulpIf(isProd, imagemin({
        progressive: true,
        interlaced: true
    })))
    .pipe(gulp.dest(`./${outputDir}/images/`))
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

const meta = () => {
    let meta = {
        symbols: {},
        sprites: {}
    };

    const icons = gulp.src(`./${inputDir}/icons/{sprites,symbols}/**/*.svg`, { read: false })
        .pipe(tap(file => {
            const parsed = path.parse(file.relative);
            let key;
            let group = 'common';
            if (parsed.dir.indexOf(path.sep) >= 0) {
                key = path.dirname(parsed.dir);
                group = path.basename(parsed.dir);
            } else {
                key = parsed.dir;
            }
            if (typeof meta[key][group] === 'undefined') {
                meta[key][group] = [];
            }
            meta[key][group].push(parsed.name);
        }));

    return merge(icons)
        .on('end', () => {
            fs.writeFileSync(config.metaPath, JSON.stringify(meta));
        });
};

export const injectAssets = () => {
    return gulp.src(`./${outputDir}/*.html`)
        .pipe(inject(
            gulp.src(`./${outputDir}/**/vendor*.{js,css}`, { read: false })
                .pipe(gulp.src([
                    `./${outputDir}/**/*.{js,css}`,
                    `!./${outputDir}/**/vendor*.{js,css}`,
                    `!./${outputDir}/css/media.css`
                ], { read: false, passthrough: true }))
                .pipe(gulp.src(`./${outputDir}/css/media.css`, { read: false, passthrough: true, allowEmpty: true })),
            {
                relative: true,
                transform: function(filepath) {
                    if (path.basename(filepath) === 'media.css') {
                        return `<link rel="stylesheet" href="${filepath}" media="all">`;
                    }
                    return inject.transform.apply(inject.transform, arguments);
                }
            }))
        .pipe(gulp.dest(`./${outputDir}`));
};

export const build = gulp.series(
    clean,
    svgSprites,
    gulp.parallel(webpack, meta, svgSymbols, copyImages, copyStatic),
    buildPages,
    injectAssets
);

const watch = () => {
    gulp.watch([`./${inputDir}/styles/**/*.scss`, `./${inputDir}/js/**/*.js`]).on('all', webpack);
    gulp.watch([
        `./${inputDir}/data/**/*`,
        `./${inputDir}/helpers/**/*`,
        `./${inputDir}/partials/**/*`,
        `./${inputDir}/*.hbs`
    ]).on('all', gulp.series(buildPages, injectAssets));
    gulp.watch(`./${inputDir}/icons/sprites/**/*`).on('all', gulp.parallel(svgSprites, meta));
    gulp.watch(`./${inputDir}/icons/symbols/**/*`).on('all', gulp.parallel(svgSymbols, meta));
    gulp.watch([`./${inputDir}/images/**/*`, `!./${inputDir}/images/icons-*.svg`]).on('all', copyImages);
    gulp.watch(`./${inputDir}/static/**/*`).on('all', copyStatic);
};

export const start = gulp.series(build, gulp.parallel(devServer, watch));
