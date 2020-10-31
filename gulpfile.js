'use strict';

const { src, dest, watch } = require('gulp');
const typescript = require('gulp-typescript');
const uglify = require('gulp-uglify');
const sass = require('gulp-sass');
const rename = require('gulp-rename');

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
                .pipe(dest('dist'))
                .pipe(uglify())
                .pipe(rename(path => path.basename += '.min'))
                .pipe(dest('dist'));
            cb();
        }
    );
    watch(
        'src/**/*.scss',
        function (cb) {
            src('src/spkbl.scss')
                .pipe(sass({ outputStyle: 'compressed' })
                    .on('error', sass.logError))
                .pipe(dest('dist'));
            cb();
        }
    );
};
