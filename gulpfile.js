'use strict';

const { src, dest, watch } = require('gulp');
const typescript = require('gulp-typescript');
const uglify = require('gulp-uglify');
const sass = require('gulp-sass');

exports.default = function () {
    watch('src/*.js', { ignoreInitial: false }, function (cb) {
        src('src/spkbl.js')
            .pipe(
                typescript(
                    {
                        target: 'ES5',
                        allowJs: true
                    }
                )
            )
            .pipe(uglify())
            .pipe(dest('dist'));
        cb();
    });
    watch('src/**/*.scss', function (cb) {
        src('src/spkbl.scss')
            .pipe(sass().on('error', sass.logError))
            .pipe(dest('dist'));
        cb();
    });
};
