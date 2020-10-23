/* eslint no-param-reassign: ["error", { "props": false }] */
(function iffe(w, d) {
    /**
     * Speech Synthesis Voices
     *
     * @type {SpeechSynthesisVoice[]}
     */
    let voices = [];
    /**
     * Global Speech Utterance
     *
     * @type {SpeechSynthesisUtterance}
     */
    let speechUtterance = null;

    /**
     * Regular expression to match punctuation
     *
     * @type {RegExp}
     */
    const punctuation = /[’'‘`“”"[\](){}…,.!;?\-:\u0964\u0965]/;

    /**
     * Default options
     *
     * @type {{multivoice: boolean, selector: string,
     * l18n: {play: string, stop: string, progress: string, pause: string}}}
     */
    const defaultOptions = {
        selector: '.spkbl',
        multivoice: true,
        hidden: true, // Hide player from assistive technology
        l18n: {
            play: 'Read text',
            pause: 'Pause',
            progress: 'Progress',
            stop: 'Resume'
        }
    };

    /**
     * Block level elements
     *
     * @type {string[]}
     */
    const blockLevelElements = ['address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'dd', 'div', 'dl',
        'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header',
        'hgroup', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul'];

    /**
     * Test whether an element is a block level element
     *
     * @param {Element} element element
     *
     * @returns {boolean} Is block level element
     */
    function isBlockLevelElement(element) {
        return blockLevelElements.indexOf(element.tagName.toLowerCase()) !== -1;
    }

    /**
     * Simple object check
     *
     * @param item Item
     *
     * @returns {boolean} Is object
     */
    function isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }

    /**
     * Deep merge multiple objects
     *
     * @param target Target object
     * @param sources Source object(s)
     */
    function mergeDeep(target, ...sources) {
        if (!sources.length) {
            return target;
        }
        const source = sources.shift();

        if (isObject(target) && isObject(source)) {
            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key) && isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }

        return mergeDeep(target, ...sources);
    }

    /**
     * Cast a value to a Boolean if possible
     *
     * @param {String} val Value
     * @return {boolean|String} Converted value
     */
    function castToBool(val) {
        if ((val === '1') || (val.toLowerCase() === 'true')) {
            return true;
        }
        if ((val === '0') || (val.toLowerCase() === 'false')) {
            return false;
        }
        return val;
    }

    /**
     * Abstract syntax tree parser
     *
     * @param {String} language Language
     * @param {Boolean} multivoice Multiple voices
     *
     * @constructor
     */
    function AstParser(language, multivoice) {
        this.lang = language;
        this.multivoice = multivoice;
        this.items = [];
    }

    /**
     * Parse an element
     *
     * @param {Element} element Element
     *
     * @returns {Object[]} Items
     */
    AstParser.prototype.parse = function parse(element) {
        element.childNodes.forEach(
            (c) => {
                if (c.nodeType === Element.ELEMENT_NODE) {
                    if (!c.hasAttribute('data-spkbl-skip')) {
                        const lang = this.multivoice ? (c.lang || this.lang) : this.lang;
                        this.items.push(
                            {
                                type: 1 + isBlockLevelElement(c),
                                lang,
                                node: c,
                                items: (new AstParser(lang, this.multivoice)).parse(c)
                            }
                        );
                    }
                } else if (c.nodeType === Element.TEXT_NODE) {
                    const text = c.nodeValue.trim()
                        .replace(/[\s\r\n]+/g, ' ');
                    if (text.length) {
                        this.items.push({
                            type: 0,
                            lang: this.lang,
                            node: c,
                            text
                        });
                    }
                }
            }
        );
        return this.items;
    };

    /**
     * Create a new sentence
     *
     * @param {String} lang Language
     *
     * @return {{chunks: [], lang: *}}
     */
    AstParser.prototype.createSentence = function createSentence(lang) {
        return {
            lang,
            chunks: []
        };
    };

    /**
     * Create a new sentence
     *
     * @param {String} lang Language
     *
     * @return {{chunks: [], lang: *}}
     */
    AstParser.prototype.createSentence = function createSentence(lang) {
        return {
            lang,
            chunks: []
        };
    };

    /**
     * Parse an element into readable chunks
     *
     * @param {Element} element Element
     *
     * @returns {Array} Readable chunks
     * @private
     */
    AstParser.prototype.createChunks = function createChunks(element) {
        const chunks = [];
        let sentence = null;
        const chunksRecursive = (c) => {
            if (sentence === null) {
                sentence = this.createSentence(c.lang);
                if (c.type) {
                    c.items.forEach(chunksRecursive);
                    if (sentence && sentence.chunks.length) {
                        chunks.push(sentence);
                    }
                    sentence = null;
                } else {
                    sentence.chunks.push({
                        node: c.node,
                        text: c.text
                    });
                }
            } else {
                switch (c.type) {
                case 2:
                    if (sentence.chunks.length) {
                        chunks.push(sentence);
                        sentence = this.createSentence(c.lang);
                    } else {
                        sentence.lang = c.lang;
                    }
                    c.items.forEach(chunksRecursive);
                    if (sentence && sentence.chunks.length) {
                        chunks.push(sentence);
                    }
                    sentence = null;
                    break;
                case 1:
                    if (c.lang === sentence.lang) {
                        c.items.forEach(chunksRecursive);
                    } else {
                        const { lang } = sentence;
                        if (sentence.chunks.length) {
                            chunks.push(sentence);
                        }
                        sentence = this.createSentence(c.lang);
                        c.items.forEach(chunksRecursive);
                        if (sentence.chunks.length) {
                            chunks.push(sentence);
                        }
                        sentence = this.createSentence(lang);
                    }
                    break;
                default:
                    sentence.chunks.push(
                        {
                            node: c.node,
                            text: c.text
                        }
                    );
                }
            }
        };
        this.parse(element)
            .forEach(chunksRecursive);
        if (sentence && sentence.chunks.length) {
            chunks[chunks.length] = sentence;
        }
        return chunks;
    };

    /**
     * Parse an element and return consolidated readable chunks
     *
     * @param {Element} element Element
     *
     * @returns {Array} Readable chunks
     */
    AstParser.prototype.chunked = function chunked(element) {
        const chunks = this.createChunks(element);
        if (!chunks.length) {
            return [];
        }

        const consolidated = [chunks.shift()];
        while (chunks.length) {
            const chunk = chunks.shift();
            const last = consolidated.length - 1;
            if (chunk.lang === consolidated[last].lang) {
                Array.prototype.push.apply(consolidated[last].chunks, chunk.chunks);
            } else {
                consolidated.push(chunk);
            }
        }
        consolidated.forEach(
            (c) => {
                let char = 0;
                c.chunks.forEach(
                    (chunk) => {
                        chunk.char = char;
                        if (!punctuation.test(chunk.text.substr(-1))) {
                            chunk.text += '.';
                        }
                        char += chunk.text.length + 1;
                    }
                );
            }
        );
        return consolidated;
    };

    /**
     * Speakable
     *
     * @param {Element} element Speakable
     * @param {Object} options Options
     *
     * @constructor
     */
    function Speakable(element, options) {
        this.element = element;
        this.options = this.configure(options, 'data-spkbl');
        this.utterances = [];
        this.currentUtterance = 0;
        this.length = 0;
        this.offset = 0;
        this.progress = 0;
        this.paused = false;
        this.nextOnResume = false;
        this.player = null;
        this.controls = {};
        this.buildPlayer();

        // Parse the element contents
        const astParser = new AstParser(this.determineLanguage(this.element) || 'en', this.options.multivoice);
        this.setUtterances(astParser.chunked(this.element));

        // Inject the player
        this.injectPlayer();
    }

    /**
     * Configure this instance by data attributes
     *
     * @param {Object} options Options
     * @param {String} prefix Attribute prefix
     *
     * @private
     */
    Speakable.prototype.configure = function configure(options, prefix) {
        const configured = {};
        for (const o in options) {
            if (Object.prototype.hasOwnProperty.call(options, o)) {
                const attr = `${prefix}-${o}`;
                if (isObject(options[o])) {
                    configured[o] = this.configure(options[o], attr);
                } else if (this.element.hasAttribute(attr)) {
                    configured[o] = castToBool(this.element.getAttribute(attr));
                } else {
                    configured[o] = options[o];
                }
            }
        }
        return configured;
    };

    /**
     * Determine element language
     *
     * @param {Element} element Element
     *
     * @private
     */
    Speakable.prototype.determineLanguage = function determineLanguage(element) {
        const { lang } = element;
        return lang || (element.parentNode ? this.determineLanguage(element.parentNode) : null);
    };

    /**
     * Build the player
     *
     * @private
     */
    Speakable.prototype.buildPlayer = function buildPlayer() {
        this.player = d.createElement('div');
        this.player.className = 'spkbl-player spkbl-player--inactive';
        this.player.role = 'group';
        if (this.options.hidden) {
            this.player.setAttribute('aria-hidden', 'true');
        }

        // Play button
        this.controls.play = d.createElement('button');
        this.controls.play.type = 'button';
        this.controls.play.className = 'spkbl-ctrl spkbl-ctrl--play';
        this.controls.play.addEventListener('click', this.play.bind(this));
        this.controls.play.innerHTML = this.options.l18n.play;
        this.player.appendChild(this.controls.play);

        // Pause button
        this.controls.pause = d.createElement('button');
        this.controls.pause.type = 'button';
        this.controls.pause.className = 'spkbl-ctrl spkbl-ctrl--pause';
        this.controls.pause.addEventListener('click', this.pause.bind(this));
        this.controls.pause.innerHTML = this.options.l18n.pause;
        this.controls.pause.setAttribute('aria-pressed', 'false');
        this.player.appendChild(this.controls.pause);

        // Progress bar
        this.controls.progress = d.createElement('progress');
        this.controls.progress.className = 'spkbl-ctrl spkbl-ctrl--progress';
        this.controls.progress.max = '100';
        this.controls.progress.value = '0';
        this.controls.progress.setAttribute('aria-label', this.options.l18n.progress);
        this.controls.progress.setAttribute('aria-hidden', 'true');
        this.controls.progress.setAttribute('readonly', 'true');
        this.controls.progress.appendChild(d.createTextNode('0%'));
        this.player.appendChild(this.controls.progress);

        // Stop button
        this.controls.stop = d.createElement('button');
        this.controls.stop.type = 'button';
        this.controls.stop.className = 'spkbl-ctrl spkbl-ctrl--stop';
        this.controls.stop.addEventListener('click', this.stop.bind(this));
        this.controls.stop.innerHTML = this.options.l18n.stop;
        this.player.appendChild(this.controls.stop);
    };

    /**
     * Start playing
     *
     * @param {Array} utterances Utterances
     *
     * @private
     */
    Speakable.prototype.setUtterances = function setUtterances(utterances) {
        this.length = 0;
        this.utterances = utterances.map(
            (u) => {
                u.text = u.chunks.map((c) => c.text)
                    .join(' ');
                u.length = u.text.length;
                this.length += u.length + 1;
                return u;
            }
        );
        this.length += 1;
    };

    /**
     * Start playing
     *
     * @param {SpeechSynthesisEvent} e Event
     */
    Speakable.prototype.play = function play(e) {
        if (Speakable.current) {
            Speakable.current.halt();
        }
        Speakable.current = this;

        this.player.classList.add('spkbl-player--active');
        this.player.classList.remove('spkbl-player--inactive');
        this.controls.pause.focus();
        d.addEventListener('keyup', this.escape.bind(this));

        this.currentUtterance = -1;
        this.offset = 0;
        this.progress = 0;

        speechSynthesis.cancel();
        speechUtterance.onboundary = this.boundary.bind(this);
        speechUtterance.onend = this.next.bind(this);

        this.next(e);
    };

    /**
     * Escape the player
     *
     * @param {KeyboardEvent} e Event
     */
    Speakable.prototype.escape = function escape(e) {
        const evt = e || window.event;
        if (('key' in evt) ? (evt.key === 'Escape' || evt.key === 'Esc') : (evt.keyCode === 27)) {
            this.stop();
        }
    };

    /**
     * Play the next utterance
     *
     * @param {SpeechSynthesisEvent} e Event
     */
    Speakable.prototype.next = function next(e) {
        if (this.paused) {
            this.nextOnResume = true;
            speechSynthesis.cancel();
        } else if (this.utterances.length > (this.currentUtterance + 1)) {
            if (this.currentUtterance >= 0) {
                this.offset += this.utterances[this.currentUtterance].length + 1;
            }
            this.currentUtterance += 1;
            const utterance = this.utterances[this.currentUtterance];
            speechUtterance.text = utterance.text;
            speechUtterance.voice = this.getUtteranceVoice(utterance);
            speechSynthesis.speak(speechUtterance);
        } else {
            this.stop(e);
        }
    };

    /**
     * Find the voice for an utterance
     *
     * @param {Object} utterance Utterance
     *
     * @returns {SpeechSynthesisVoice} Voice
     *
     * @private
     */
    Speakable.prototype.getUtteranceVoice = function getUtteranceVoice(utterance) {
        if (!utterance.voice) {
            utterance.voice = voices.find((v) => (v.lang === utterance.lang) || v.lang.startsWith(`${utterance.lang}-`))
                || voices.find((v) => v.default)
                || voices[0];
        }
        return utterance.voice;
    };

    /**
     * Boundary handler
     *
     * @param {SpeechSynthesisEvent} e Event
     */
    Speakable.prototype.boundary = function boundary(e) {
        this.progress = Math.round((100 * (this.offset + e.charIndex)) / this.length);
        this.controls.progress.value = this.progress;
        this.controls.progress.textContent = `${this.progress} % `;
        // console.debug(this.progress, e.name, speechUtterance.text.substr(e.charIndex, e.charLength));
    };

    /**
     * Pause / Resume playing
     */
    Speakable.prototype.pause = function pause() {
        speechSynthesis[this.togglePause(this.paused) ? 'pause' : 'resume']();
        if (this.nextOnResume) {
            this.nextOnResume = false;
            this.next();
        }
    };

    /**
     * Toggle pause button
     *
     * @var {Boolean} paused Is paused
     *
     * @return {Boolean} Is paused
     */
    Speakable.prototype.togglePause = function togglePause(paused) {
        this.paused = !paused;
        this.player.classList[paused ? 'remove' : 'add']('spkbl-player--paused');
        this.controls.pause.setAttribute('aria-pressed', paused ? 'false' : 'true');
        return this.paused;
    };

    /**
     * Stop playing and reset player
     */
    Speakable.prototype.stop = function stop() {
        this.halt();
        this.controls.play.focus();
    };

    /**
     * Stop playing
     */
    Speakable.prototype.halt = function halt() {
        speechUtterance.onboundary = null;
        speechUtterance.onend = null;
        speechSynthesis.cancel();
        this.togglePause(true);
        d.removeEventListener('keyup', this.escape.bind(this));

        this.player.classList.add('spkbl-player--inactive');
        this.player.classList.remove('spkbl-player--active');
        this.player.classList.remove('spkbl-player--paused');
    };

    /**
     * Inject the player
     *
     * @private
     */
    Speakable.prototype.injectPlayer = function injectPlayer() {
        if (typeof this.options.insert === 'function') {
            this.options.insert(this.element, this.player);
            return;
        }
        switch (this.options.insert) {
        case 'before':
            this.element.parentNode.insertBefore(this.player, this.element);
            break;
        case 'after':
            this.element.parentNode.insertBefore(this.player, this.element.nextSibling);
            break;
        default:
            this.element.insertBefore(this.player, this.element.firstChild);
        }
    };

    /**
     * Currently active player
     *
     * @type {Speakable}
     */
    Speakable.current = null;

    /**
     * Initialize all speakables
     *
     * @param {Object} options Options
     *
     * @returns {Array} Speakables
     */
    Speakable.init = function init(options = {}) {
        // If the Web Speech API is supported
        if ('SpeechSynthesisUtterance' in w) {
            speechUtterance = new SpeechSynthesisUtterance();
            speechUtterance.volume = 1;
            speechUtterance.pitch = 1;
            speechUtterance.rate = 1;
            voices = speechSynthesis.getVoices();
            speechSynthesis.addEventListener(
                'voiceschanged',
                () => {
                    voices = speechSynthesis.getVoices();
                }
            );

            const opts = mergeDeep(defaultOptions, options);
            const selector = opts.selector || '';
            delete opts.selector;
            return selector.length ? Array.from(d.querySelectorAll(selector))
                .map((s) => new Speakable(s, opts)) : [];
        }

        return [];
    };

    if (typeof exports !== 'undefined') {
        exports.Speakable = Speakable;
    } else {
        w.Speakable = Speakable;
    }

    // // Sentence splitting
    // const initSplit = /(\S.+?[.!?\u203D\u2E18\u203C\u2047-\u2049])(?=\s+|$)/g;
    // const hasSomething = /\S/;
    // const isAcronym = /[ .][A-Z]\.? *$/i;
    // const hasEllipse = /(?:\u2026|\.{2,}) *$/;
    // const newLine = /((?:\r?\n|\r)+)/; // Match different new-line formats
    // const hasLetter = new ReqExp('[a-z0-9\\u00C0-\\u00FF\\u00a9|\\u00ae|[\\u2000-\\u3300]|\\ud83c[\\ud000-\\udfff]' +
    //     '|\\ud83d[\\ud000-\\udfff]|\\ud83e[\\ud000-\\udfff]', 'i');
    // const startWhitespace = /^\s+/;
    // /**
    //  * Naiive splitting
    //  *
    //  * @param {String} text Text
    //  *
    //  * @returns {[]} Sentences
    //  */
    // function naiiveSplit(text) {
    //     const all = [];
    //     const lines = text.split(newLine);
    //     for (let i = 0; i < lines.length; ++i) {
    //         const arr = lines[i].split(initSplit);
    //         for (let o = 0; o < arr.length; ++o) {
    //             all.push(arr[o]);
    //         }
    //     }
    //     return all;
    // }
    //
    // /**
    //  * Test if a string is a sentence
    //  *
    //  * @param {String} str Text
    //  * @param {Object} abbrevs Abbreviations
    //  *
    //  * @returns {boolean} Looks like a sentence
    //  */
    // function isSentence(str, abbrevs) {
    //     // check for 'F.B.I.'
    //     if (isAcronym.test(str) === true) {
    //         return false;
    //     }
    //     // check for '...'
    //     if (hasEllipse.test(str) === true) {
    //         return false;
    //     }
    //     // must have a letter
    //     if (hasLetter.test(str) === false) {
    //         return false;
    //     }
    //
    //     const txt = str.replace(/[.!?\u203D\u2E18\u203C\u2047-\u2049] *$/, '');
    //     const words = txt.split(' ');
    //     const lastWord = words[words.length - 1].toLowerCase();
    //
    //     // check for 'Mr.'
    //     if (Object.prototype.hasOwnProperty.call(abbrevs, lastWord)) {
    //         return false;
    //     }
    //     return true;
    // }
    //
    // /**
    //  * Split a text into sentences
    //  *
    //  * @param {String} initialText Text
    //  *
    //  * @returns {string[]|[]} Sentences
    //  */
    // const splitSentences = function splitSentences(initialText) {
    //     // let abbrevs = world.cache.abbreviations
    //     const abbrevs = {};
    //
    //     let text = initialText || '';
    //     text = String(text);
    //     const sentences = [];
    //
    //     // First do a greedy-split..
    //     const chunks = [];
    //
    //     // Ensure it 'smells like' a sentence
    //     if (!text || typeof text !== 'string' || hasSomething.test(text) === false) {
    //         return sentences;
    //     }
    //
    //     // cleanup unicode-spaces
    //     text = text.replace('\xa0', ' ');
    //
    //     // Start somewhere:
    //     const splits = naiiveSplit(text);
    //
    //     // Filter-out the crap ones
    //     for (let i = 0; i < splits.length; ++i) {
    //         const s = splits[i];
    //         if (s !== undefined && s !== '') {
    //             // this is meaningful whitespace
    //             if (hasSomething.test(s) === false) {
    //                 // add it to the last one
    //                 if (chunks[chunks.length - 1]) {
    //                     chunks[chunks.length - 1] += s;
    //                 } else if (splits[i + 1]) {
    //                     // add it to the next one
    //                     splits[i + 1] = s + splits[i + 1];
    //                 } else {
    //                     chunks.push(s);
    //                 }
    //             } else {
    //                 // else, only whitespace, no terms, no sentence
    //                 chunks.push(s);
    //             }
    //         }
    //     }
    //
    //     // detection of non-sentence chunks:
    //     // loop through these chunks, and join the non-sentence chunks back together..
    //     for (let i = 0; i < chunks.length; ++i) {
    //         const c = chunks[i];
    //         // should this chunk be combined with the next one?
    //         if (chunks[i + 1] && isSentence(c, abbrevs) === false) {
    //             chunks[i + 1] = c + (chunks[i + 1] || '');
    //         } else if (c && c.length > 0) {
    //             // && hasLetter.test(c)
    //             // this chunk is a proper sentence..
    //             sentences.push(c);
    //             chunks[i] = '';
    //         }
    //     }
    //     // if we never got a sentence, return the given text
    //     if (!sentences.length) {
    //         return [text];
    //     }
    //
    //     // move whitespace to the ends of sentences, when possible
    //     // ['hello',' world'] -> ['hello ','world']
    //     for (let i = 1; i < sentences.length; i += 1) {
    //         const ws = sentences[i].match(startWhitespace);
    //         if (ws !== null) {
    //             sentences[i - 1] += ws[0];
    //             sentences[i] = sentences[i].replace(startWhitespace, '');
    //         }
    //     }
    //     return sentences;
    // };
}(typeof global !== 'undefined' ? global : window, document));
