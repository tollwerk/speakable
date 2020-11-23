/* Speakable Text-To-Speech player 0.1.0 | https://github.com/tollwerk/speakable */
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
/* eslint no-param-reassign: ["error", { "props": false }] */
(function iffe(w, d) {
    /**
     * Speech Synthesis Voices
     *
     * @type {SpeechSynthesisVoice[]}
     */
    var voices = [];
    /**
     * Global Speech Utterance
     *
     * @type {SpeechSynthesisUtterance}
     */
    var speechUtterance = null;
    /**
     * Regular expression to match punctuation
     *
     * @type {RegExp}
     */
    var punctuation = /[’'‘`“”"[\](){}…,.!;?\-:\u0964\u0965]\s*$/;
    /**
     * Characters that should be stripped from output
     *
     * @type {RegExp}
     */
    var dontspeak = /[·‧*]|(?:(?<=\w):(?=\w))/gi;
    /**
     * Default options
     *
     * @type {{multivoice: boolean, selector: string,
     * l18n: {play: string, stop: string, progress: string, pause: string}}}
     */
    var defaultOptions = {
        selector: '.spkbl',
        multivoice: true,
        hidden: true,
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
    var blockLevelElements = ['address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'dd', 'div', 'dl',
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
    function mergeDeep(target) {
        var _a, _b;
        var sources = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            sources[_i - 1] = arguments[_i];
        }
        if (!sources.length) {
            return target;
        }
        var source = sources.shift();
        if (isObject(target) && isObject(source)) {
            for (var key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key) && isObject(source[key])) {
                    if (!target[key])
                        Object.assign(target, (_a = {}, _a[key] = {}, _a));
                    mergeDeep(target[key], source[key]);
                }
                else {
                    Object.assign(target, (_b = {}, _b[key] = source[key], _b));
                }
            }
        }
        return mergeDeep.apply(void 0, __spreadArrays([target], sources));
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
     * Recursively parse an element
     *
     * The method recursively traverses the DOM, collects readable elements, determines their language, filters out
     * elements that should be skipped and extracts the readable text. The result is a hierarchichal structure of
     * readable elements, stored in the parser's .items property, somewhat looking like this:
     *
     * items = [
     *     {
     *         lang: "en",
     *         node: text, // DOM node reference
     *         type: 0,
     *         text: "Readable text"
     *     },
     *     {
     *         lang: "en",
     *         node: p, // DOM node reference
     *         type: 2,
     *         items: [...]
     *     },
     *     ...
     * ]
     *
     * The "type" value specifies the item type:
     *
     * 0: Text node
     * 1: Inline element
     * 2: Block element
     *
     * @param {Element} element Element
     *
     * @returns {Object[]} Items
     */
    AstParser.prototype.parse = function parse(element) {
        var _this = this;
        element.childNodes.forEach(function (c) {
            if (c.nodeType === Element.ELEMENT_NODE) {
                if (!c.hasAttribute('data-spkbl-skip')) {
                    var lang = _this.multivoice ? (c.lang || _this.lang) : _this.lang;
                    _this.items.push({
                        type: 1 + isBlockLevelElement(c),
                        lang: lang,
                        node: c,
                        items: (new AstParser(lang, _this.multivoice)).parse(c)
                    });
                }
            }
            else if (c.nodeType === Element.TEXT_NODE) {
                var text = c.nodeValue;
                if (text.trim().length) {
                    text = text.replace(/[\s\r\n]+/g, ' ');
                    text = text.replace(dontspeak, '');
                    _this.items.push({
                        type: 0,
                        lang: _this.lang,
                        node: c,
                        text: text
                    });
                }
            }
        });
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
            lang: lang,
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
        var _this = this;
        var chunks = [];
        var sentence = null;
        var chunksRecursive = function (c) {
            if (sentence === null) {
                sentence = _this.createSentence(c.lang);
                if (c.type) {
                    c.items.forEach(chunksRecursive);
                    if (sentence && sentence.chunks.length) {
                        chunks.push(sentence);
                    }
                    sentence = null;
                }
                else {
                    sentence.chunks.push({
                        node: c.node,
                        text: c.text
                    });
                }
            }
            else {
                switch (c.type) {
                    case 2:
                        if (sentence.chunks.length) {
                            chunks.push(sentence);
                            sentence = _this.createSentence(c.lang);
                        }
                        else {
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
                        }
                        else {
                            var lang = sentence.lang;
                            if (sentence.chunks.length) {
                                chunks.push(sentence);
                            }
                            sentence = _this.createSentence(c.lang);
                            c.items.forEach(chunksRecursive);
                            if (sentence.chunks.length) {
                                chunks.push(sentence);
                            }
                            sentence = _this.createSentence(lang);
                        }
                        break;
                    default:
                        sentence.chunks.push({
                            node: c.node,
                            text: c.text
                        });
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
     * Collapse a chunk's text nodes and build a node source map
     *
     * @param {Object} chunk Chunk
     *
     * @return {{sourcemap: {}, text: string, lang: string}}
     */
    AstParser.prototype.map = function map(chunk) {
        var mappedChunk = {
            lang: chunk.lang,
            text: '',
            map: new Map()
        };
        chunk.chunks.forEach(function (c) {
            // const wrap = d.createElementNS('https://tollwerk.de/speakable/1.0', 's:s');
            // c.node.after(wrap);
            // wrap.appendChild(c.node);
            // mappedChunk.map.set(mappedChunk.text.length, wrap);
            mappedChunk.map.set(mappedChunk.text.length, c.node);
            mappedChunk.text += c.text;
        });
        return mappedChunk;
    };
    /**
     * Parse an element and return consolidated readable chunks
     *
     * @param {Element} element Element
     *
     * @returns {Array} Readable chunks
     */
    AstParser.prototype.chunked = function chunked(element) {
        var chunks = this.createChunks(element);
        if (!chunks.length) {
            return [];
        }
        // Run through all chunks, collapse the text nodes and build corresponding sourcemaps
        var chunkMaps = chunks.map(this.map);
        var consolidated = [chunkMaps.shift()];
        var _loop_1 = function () {
            var chunk = chunkMaps.shift();
            var last = consolidated.length - 1;
            if (chunk.lang === consolidated[last].lang) {
                if (!punctuation.test(consolidated[last].text)) {
                    consolidated[last].text += '.';
                }
                consolidated[last].text = consolidated[last].text.trim() + " ";
                var offset_1 = consolidated[last].text.length;
                consolidated[last].text += chunk.text;
                chunk.map.forEach(function (value, key) {
                    consolidated[last].map.set(offset_1 + key, value);
                });
            }
            else {
                consolidated.push(chunk);
            }
        };
        while (chunkMaps.length) {
            _loop_1();
        }
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
        var astParser = new AstParser(this.determineLanguage(this.element) || 'en', this.options.multivoice);
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
        var configured = {};
        for (var o in options) {
            if (Object.prototype.hasOwnProperty.call(options, o)) {
                var attr = prefix + "-" + o;
                if (isObject(options[o])) {
                    configured[o] = this.configure(options[o], attr);
                }
                else if (this.element.hasAttribute(attr)) {
                    configured[o] = castToBool(this.element.getAttribute(attr));
                }
                else {
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
        var lang = element.lang;
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
        var _this = this;
        this.length = 0;
        this.utterances = utterances.map(function (u) {
            u.length = u.text.length;
            _this.length += u.length + 1;
            return u;
        });
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
        var evt = e || window.event;
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
        }
        else if (this.utterances.length > (this.currentUtterance + 1)) {
            if (this.currentUtterance >= 0) {
                this.offset += this.utterances[this.currentUtterance].length + 1;
            }
            this.currentUtterance += 1;
            var utterance = this.utterances[this.currentUtterance];
            speechUtterance.text = utterance.text;
            speechUtterance.voice = this.getUtteranceVoice(utterance);
            speechSynthesis.speak(speechUtterance);
        }
        else {
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
            var locale_1 = utterance.lang;
            var lang_1 = locale_1.split('-')
                .shift();
            utterance.voice = voices.find(function (v) { return (v.lang === locale_1) || (v.lang === lang_1)
                || v.lang.startsWith(locale_1 + "-") || v.lang.startsWith(lang_1 + "-"); })
                || voices.find(function (v) { return v.default; }) || voices[0];
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
        this.controls.progress.textContent = this.progress + " % ";
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
    Speakable.init = function init(options) {
        if (options === void 0) { options = {}; }
        // If the Web Speech API is supported
        if ('SpeechSynthesisUtterance' in w) {
            speechUtterance = new SpeechSynthesisUtterance();
            speechUtterance.volume = 1;
            speechUtterance.pitch = 1;
            speechUtterance.rate = 1;
            voices = speechSynthesis.getVoices();
            // Safari iOS doesn't support the addEventListener() method for the speechSynthesis
            if (speechSynthesis.addEventListener) {
                speechSynthesis.addEventListener('voiceschanged', function () {
                    voices = speechSynthesis.getVoices();
                });
            }
            var opts_1 = mergeDeep(defaultOptions, options);
            var selector = opts_1.selector || '';
            delete opts_1.selector;
            return selector.length ? Array.from(d.querySelectorAll(selector))
                .map(function (s) { return new Speakable(s, opts_1); }) : [];
        }
        return [];
    };
    if (typeof exports !== 'undefined') {
        exports.Speakable = Speakable;
    }
    else {
        w.Speakable = Speakable;
    }
}(typeof global !== 'undefined' ? global : window, document));
