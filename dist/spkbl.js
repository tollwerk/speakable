(function (w, d) {
    'use strict';
    /**
     * Default options
     *
     * @type {{selector: string}}
     */
    var defaultOptions = {
        selector: '.spkbl',
        insert: 'before',
        multivoice: true
    };
    /**
     * Language labels
     *
     * @type {{ctrl: {play: string, stop: string, progress: string, pause: string}}}
     */
    var l18n = {
        ctrl: {
            play: 'Text vorlesen',
            pause: 'Pause',
            progress: 'Fortschritt',
            stop: 'Schließen'
        }
    };
    /**
     * Block level elements
     *
     * @type {string[]}
     */
    var blockLevelElements = ['address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul'];
    /**
     * Abstract syntax tree parser
     *
     * @param {String} language Language
     * @param {Boolean} multivoice Multiple voices
     *
     * @constructor
     */
    function AstParser(language, multivoice)
    {
        this.lang = language;
        this.multivoice = multivoice;
        this.items = [];
    }
    /**
     * Parse an element
     *
     * @param {Element} element Element
     *
     * @returns {[]} Items
     */
    AstParser.prototype._parse = function (element) {
        var _this = this;
        var store = null;
        element.childNodes.forEach(
            function (c) {
                if (c.nodeType === Element.ELEMENT_NODE) {
                    var lang = _this.multivoice ? (c.lang || _this.lang) : _this.lang;
                    _this.items.push(
                        {
                            type: 1 + _this._isBlockLevelElement(c),
                            lang: lang,
                            node: c,
                            items: (new AstParser(lang, _this.multivoice))._parse(c),
                        }
                    );
                } else if (c.nodeType === Element.TEXT_NODE) {
                    var text = c.nodeValue.trim().replace(/[\s\r\n]+/g, ' ');
                    if (text.length) {
                        _this.items.push(
                            {
                                type: 0,
                                lang: _this.lang,
                                node: c,
                                text: text
                            }
                        );
                    }
                }
            }
        );
        return this.items;
    };
    /**
     * Test whether an element is a block level element
     *
     * @param {Element} element element
     *
     * @returns {boolean} Is block level element
     */
    AstParser.prototype._isBlockLevelElement = function (element) {
        return blockLevelElements.indexOf(element.tagName.toLowerCase()) !== -1;
    };
    /**
     * Chunk the parsed items
     *
     * @param {Element} element Element
     *
     * @returns {Array} Chunked items
     */
    AstParser.prototype.chunked = function (element) {
        var chunks = [];
        var sentence = null;
        var chunksRecursive = function (c) {
            if (sentence === null) {
                if (c.type) {
                    sentence = { lang: c.lang, chunks: [] };
                    c.items.forEach(chunksRecursive);
                    chunks.push(sentence);
                    sentence = null;
                } else {
                    sentence = { lang: c.lang, chunks: [{ node: c.node, text: c.text }] };
                }
            } else {
                switch (c.type) {
                    case 2:
                        if (sentence.chunks.length) {
                            chunks.push(sentence);
                            sentence = { lang: c.lang, chunks: [] };
                    } else {
                        sentence.lang = c.lang;
                    }
                    c.items.forEach(chunksRecursive);
                    if (sentence.chunks.length) {
                        chunks.push(sentence);
                    }
                    sentence = null;
                        break;
                case 1:
                    if (c.lang === sentence.lang) {
                        c.items.forEach(chunksRecursive);
                    } else {
                        var lang = sentence.lang;
                        if (sentence.chunks.length) {
                            chunks.push(sentence);
                        }
                        sentence = { lang: c.lang, chunks: [] };
                        c.items.forEach(chunksRecursive);
                        if (sentence.chunks.length) {
                            chunks.push(sentence);
                        }
                        sentence = { lang: lang, chunks: [] };
                    }
                        break;
                default:
                    sentence.chunks.push({ node: c.node, text: c.text });
                }
            }
        };
        this._parse(element).forEach(chunksRecursive);
        if (sentence && sentence.chunks.length) {
            chunks.push(sentence);
        }
        if (chunks.length) {
            var consolidated = [chunks.shift()];
            do {
                var chunk = chunks.shift();
                var last = consolidated.length - 1;
                if (chunk.lang === consolidated[last].lang) {
                    Array.prototype.push.apply(consolidated[last].chunks, chunk.chunks);
                } else {
                    consolidated.push(chunk);
                }
            } while (chunks.length);
            consolidated.forEach(
                function (c) {
                    var char = 0;
                    c.chunks.forEach(
                        function (chunk) {
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
        }
        return [];
    };
    /**
     * Speech Synthesis Voices
     *
     * @type {*[SpeechSynthesisVoice]}
     */
    var voices = [];
    var speechUtterance = null;
    // Sentence splitting
    var initSplit = /(\S.+?[.!?\u203D\u2E18\u203C\u2047-\u2049])(?=\s+|$)/g;
    var hasSomething = /\S/;
    var isAcronym = /[ .][A-Z]\.? *$/i;
    var hasEllipse = /(?:\u2026|\.{2,}) *$/;
    var newLine = /((?:\r?\n|\r)+)/; // Match different new-line formats
    var hasLetter = /[a-z0-9\u00C0-\u00FF\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]/i;
    var startWhitespace = /^\s+/;
    var punctuation = /[’'‘’`“”"\[\]\(\){}…,\.!;\?\-:\u0964\u0965]/;
    /**
     * Naiive splitting
     *
     * @param {String} text Text
     *
     * @returns {[]} Sentences
     */
    function naiiveSplit(text)
    {
        var all = [];
        var lines = text.split(newLine);
        for (var i = 0; i < lines.length; ++i) {
            var arr = lines[i].split(initSplit);
            for (var o = 0; o < arr.length; ++o) {
                all.push(arr[o]);
            }
        }
        return all;
    }
    /**
     * Test if a string is a sentence
     *
     * @param {String} str Text
     * @param {Object} abbrevs Abbreviations
     *
     * @returns {boolean} Looks like a sentence
     */
    function isSentence(str, abbrevs)
    {
        // check for 'F.B.I.'
        if (isAcronym.test(str) === true) {
            return false;
        }
        //check for '...'
        if (hasEllipse.test(str) === true) {
            return false;
        }
        // must have a letter
        if (hasLetter.test(str) === false) {
            return false;
        }
        var txt = str.replace(/[.!?\u203D\u2E18\u203C\u2047-\u2049] *$/, '');
        var words = txt.split(' ');
        var lastWord = words[words.length - 1].toLowerCase();
        // check for 'Mr.'
        if (abbrevs.hasOwnProperty(lastWord)) {
            return false;
        }
        return true;
    }
    /**
     * Split a text into sentences
     *
     * @param {String} text Text
     *
     * @returns {string[]|[]} Sentences
     */
    var splitSentences = function (text) {
        // let abbrevs = world.cache.abbreviations
        var abbrevs = {};
        text = text || '';
        text = String(text);
        var sentences = [];
        // First do a greedy-split..
        var chunks = [];
        // Ensure it 'smells like' a sentence
        if (!text || typeof text !== 'string' || hasSomething.test(text) === false) {
            return sentences;
        }
        // cleanup unicode-spaces
        text = text.replace('\xa0', ' ');
        // Start somewhere:
        var splits = naiiveSplit(text);
        // Filter-out the crap ones
        for (var i = 0; i < splits.length; ++i) {
            var s = splits[i];
            if (s === undefined || s === '') {
                continue;
            }
            //this is meaningful whitespace
            if (hasSomething.test(s) === false) {
                //add it to the last one
                if (chunks[chunks.length - 1]) {
                    chunks[chunks.length - 1] += s;
                    continue;
                } else if (splits[i + 1]) {
                    //add it to the next one
                    splits[i + 1] = s + splits[i + 1];
                    continue;
                }
            }
            //else, only whitespace, no terms, no sentence
            chunks.push(s);
        }
        //detection of non-sentence chunks:
        //loop through these chunks, and join the non-sentence chunks back together..
        for (var i = 0; i < chunks.length; ++i) {
            var c = chunks[i];
            //should this chunk be combined with the next one?
            if (chunks[i + 1] && isSentence(c, abbrevs) === false) {
                chunks[i + 1] = c + (chunks[i + 1] || '');
            } else if (c && c.length > 0) {
                //&& hasLetter.test(c)
                //this chunk is a proper sentence..
                sentences.push(c);
                chunks[i] = '';
            }
        }
        //if we never got a sentence, return the given text
        if (!sentences.length) {
            return [text];
        }
        //move whitespace to the ends of sentences, when possible
        //['hello',' world'] -> ['hello ','world']
        for (var i = 1; i < sentences.length; i += 1) {
            var ws = sentences[i].match(startWhitespace);
            if (ws !== null) {
                sentences[i - 1] += ws[0];
                sentences[i] = sentences[i].replace(startWhitespace, '');
            }
        }
        return sentences;
    };
    /**
     * Speakable
     *
     * @param {Element} element Speakable
     * @param {Object} options Options
     *
     * @constructor
     */
    function Speakable(element, options)
    {
        this.element = element;
        this.options = options;
        this._utterances = [];
        this._currentUtterance = 0;
        this._length = 0;
        this._offset = 0;
        this._progress = 0;
        this._player = null;
        this._controls = {};
        this._buildPlayer();
        this._injectPlayer();
        // Parse the element contents
        var astParser = new AstParser(this._determineLanguage(this.element) || 'en', this.options.multivoice);
        this._setUtterances(astParser.chunked(this.element));
    }
    /**
     * Determine element language
     *
     * @param {Element} element Element
     *
     * @private
     */
    Speakable.prototype._determineLanguage = function (element) {
        var lang = element.lang;
        return lang || (element.parentNode ? this._determineLanguage(element.parentNode) : null);
    };
    /**
     * Build the player
     *
     * @private
     */
    Speakable.prototype._buildPlayer = function () {
        this._player = d.createElement('div');
        this._player.className = 'spkbl-player spkbl-player--inactive';
        this._player.role = 'group';
        // Play button
        this._controls.play = d.createElement('button');
        this._controls.play.type = 'button';
        this._controls.play.className = 'spkbl-ctrl spkbl-ctrl--play';
        this._controls.play.addEventListener('click', this.play.bind(this));
        this._controls.play.appendChild(d.createTextNode(l18n.ctrl.play));
        this._player.appendChild(this._controls.play);
        // Pause button
        this._controls.pause = d.createElement('button');
        this._controls.pause.type = 'button';
        this._controls.pause.className = 'spkbl-ctrl spkbl-ctrl--pause';
        this._controls.pause.addEventListener('click', this.pause.bind(this));
        this._controls.pause.appendChild(d.createTextNode(l18n.ctrl.pause));
        this._controls.pause.setAttribute('aria-pressed', 'false');
        this._player.appendChild(this._controls.pause);
        // Scrubber
        this._controls.progress = d.createElement('progress');
        this._controls.progress.className = 'spkbl-ctrl spkbl-ctrl--progress';
        this._controls.progress.max = '100';
        this._controls.progress.value = '0';
        this._controls.progress.setAttribute('aria-label', l18n.ctrl.progress);
        this._controls.progress.setAttribute('aria-hidden', 'true');
        this._controls.progress.setAttribute('readonly', 'true');
        this._controls.progress.appendChild(d.createTextNode('0%'));
        this._player.appendChild(this._controls.progress);
        // Stop button
        this._controls.stop = d.createElement('button');
        this._controls.stop.type = 'button';
        this._controls.stop.className = 'spkbl-ctrl spkbl-ctrl--stop';
        this._controls.stop.addEventListener('click', this.stop.bind(this));
        this._controls.stop.appendChild(d.createTextNode(l18n.ctrl.stop));
        this._player.appendChild(this._controls.stop);
    };
    /**
     * Start playing
     *
     * @param {Array} utterances Utterances
     */
    Speakable.prototype._setUtterances = function (utterances) {
        var _this = this;
        this._length = 0;
        this._utterances = utterances.map(
            function (u) {
                u.text = u.chunks.map(
                    function (c) {
                        return c.text; }
                ).join(' ');
                u.length = u.text.length;
                _this._length += u.length + 1;
                return u;
            }
        );
        console.table(this._utterances);
        --this._length;
    };
    /**
     * Start playing
     *
     * @param {SpeechSynthesisEvent} e Event
     */
    Speakable.prototype.play = function (e) {
        this._player.classList.add('spkbl-player--active');
        this._player.classList.remove('spkbl-player--inactive');
        this._controls.pause.focus();
        this._currentUtterance = -1;
        this._offset = 0;
        this._progress = 0;
        speechSynthesis.cancel();
        speechUtterance.onboundary = this.boundary.bind(this);
        speechUtterance.onend = this.next.bind(this);
        this.next(e);
    };
    /**
     * Play the next utterance
     *
     * @param {SpeechSynthesisEvent} e Event
     */
    Speakable.prototype.next = function (e) {
        if (this._utterances.length > (this._currentUtterance + 1)) {
            if (this._currentUtterance >= 0) {
                this._offset += this._utterances[this._currentUtterance].length + 1;
            }
            var utterance = this._utterances[++this._currentUtterance];
            speechUtterance.text = utterance.text;
            speechUtterance.voice = this._getUtteranceVoice(utterance);
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
    Speakable.prototype._getUtteranceVoice = function (utterance) {
        if (!utterance.voice) {
            utterance.voice = voices.find(
                function (v) {
                    return (v.lang === utterance.lang) || v.lang.startsWith(utterance.lang + '-'); }
            )
                || voices.find(
                    function (v) {
                        return v.default; }
                )
                || voices[0];
        }
        return utterance.voice;
    };
    /**
     * Boundary handler
     *
     * @param {SpeechSynthesisEvent} e Event
     */
    Speakable.prototype.boundary = function (e) {
        this._progress = Math.round(100 * (this._offset + e.charIndex) / this._length);
        this._controls.progress.value = this._progress;
        this._controls.progress.textContent = this._progress + "%";
        console.debug(this._progress, e.name, speechUtterance.text.substr(e.charIndex, e.charLength));
    };
    /**
     * Pause / Resume playing
     *
     * @param {Event} e Event
     */
    Speakable.prototype.pause = function (e) {
        if (speechSynthesis.speaking) {
            if (speechSynthesis.paused) {
                speechSynthesis.resume();
                this._player.classList.remove('spkbl-player--paused');
                this._controls.pause.setAttribute('aria-pressed', 'false');
            } else {
                speechSynthesis.pause();
                this._player.classList.add('spkbl-player--paused');
                this._controls.pause.setAttribute('aria-pressed', 'true');
            }
        }
    };
    /**
     * Stop playing
     *
     * @param {Event} e Event
     */
    Speakable.prototype.stop = function (e) {
        speechUtterance.onboundary = null;
        speechUtterance.onend = null;
        speechSynthesis.cancel();
        this._player.classList.add('spkbl-player--inactive');
        this._player.classList.remove('spkbl-player--active');
        this._player.classList.remove('spkbl-player--paused');
        this._controls.play.focus();
    };
    /**
     * Inject the player
     *
     * @private
     */
    Speakable.prototype._injectPlayer = function () {
        if (typeof this.options.insert === "function") {
            this.options.insert(this.element, this._player);
            return;
        }
        switch (this.options.insert) {
        case 'before':
            this.element.parentNode.insertBefore(this._player, this.element);
                break;
        case 'after':
            this.element.parentNode.insertBefore(this._player, this.element.nextSibling);
                break;
        default:
            this.element.insertBefore(this._player, this.element.firstChild);
        }
    };
    /**
     * Initialize all speakables
     *
     * @param {Object} options Options
     *
     * @returns {Array} Speakables
     */
    Speakable.init = function (options) {
        if (options === void 0) {
            options = {}; }
        // If the Web Speech API is supported
        if ('SpeechSynthesisUtterance' in w) {
            speechUtterance = new SpeechSynthesisUtterance();
            speechUtterance.volume = 1;
            speechUtterance.pitch = 1;
            speechUtterance.rate = 1;
            voices = speechSynthesis.getVoices();
            speechSynthesis.addEventListener(
                'voiceschanged',
                function () {
                    voices = speechSynthesis.getVoices();
                }
            );
            var opts_1 = Object.assign(defaultOptions, options);
            var selector = opts_1.selector || '';
            return selector.length ? Array.from(d.querySelectorAll(selector)).map(
                function (s) {
                    return new Speakable(s, opts_1); }
            ) : [];
        }
        return [];
    };
    if (typeof exports !== 'undefined') {
        exports.Speakable = Speakable;
    } else {
        w.Speakable = Speakable;
    }
})(typeof global !== 'undefined' ? global : window, document);
