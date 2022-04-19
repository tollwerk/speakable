const { src, dest, watch } = require('gulp');
const typescript = require('gulp-typescript');
const uglify = require('gulp-uglify');
const sass = require('gulp-sass')(require('node-sass'));
const rename = require('gulp-rename');
const insert = require('gulp-insert');
const replace = require('gulp-replace');
const version = require('./package.json').version;
const prepend = `/* Speakable Text-To-Speech player ${version} | https://github.com/tollwerk/speakable */\n`;

exports.default = function () {
    watch(
        'src/*.js',
        { ignoreInitial: false },
        function () {
            return src('src/spkbl.js')
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
        }
    );
    watch(
        'src/**/*.scss',
        { ignoreInitial: false },
        function () {
            return src('src/spkbl.scss')
                .pipe(sass({ outputStyle: 'compressed' })
                    .on('error', sass.logError))
                .pipe(insert.prepend(prepend))
                .pipe(dest('dist'));
        }
    );
    watch(
        'docs/local.html',
        { ignoreInitial: false },
        function () {
            return src('docs/local.html')
                .pipe(replace('../dist/', `https://cdn.jsdelivr.net/gh/tollwerk/speakable@${version}/dist/`))
                .pipe(rename(path => path.basename = 'index'))
                .pipe(dest('docs'));
        }
    );
};
