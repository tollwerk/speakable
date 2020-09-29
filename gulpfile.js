'use strict';

const { src, dest, watch } = require('gulp');
const typescript = require('gulp-typescript');
const uglify = require('gulp-uglify');

exports.default = function () {
    watch('src/*.js', { ignoreInitial: false }, function (cb) {
        src('src/index.js')
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
};
