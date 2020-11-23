'use strict';

const { src, dest, watch } = require('gulp');
const typescript = require('gulp-typescript');
const uglify = require('gulp-uglify');
const sass = require('gulp-sass');
const rename = require('gulp-rename');
const insert = require('gulp-insert');
const prepend = `/* Speakable Text-To-Speech player ${require('./package.json').version} | https://github.com/tollwerk/speakable */\n`;

exports.default = function () {
    watch(
        'src/*.js',
        { ignoreInitial: false },
        function (cb) {
            src('src/spkbl.js')
                .pipe(
                    typescript(
                        {
                            target: 'ES5',
                            allowJs: true
                        }
                    )
                )
                .pipe(insert.prepend(prepend))
                .pipe(dest('dist'))
                .pipe(uglify())
                .pipe(rename(path => path.basename += '.min'))
                .pipe(insert.prepend(prepend))
                .pipe(dest('dist'));
            cb();
        }
    );
    watch(
        'src/**/*.scss',
        { ignoreInitial: false },
        function (cb) {
            src('src/spkbl.scss')
                .pipe(sass({ outputStyle: 'compressed' })
                    .on('error', sass.logError))
                .pipe(insert.prepend(prepend))
                .pipe(dest('dist'));
            cb();
        }
    );
};
