(function (w, d) {
    'use strict';

    /**
     * Default options
     *
     * @type {{selector: string}}
     */
    const defaultOptions = {
        selector: '.spkbl',
        insert: 'before'
    }

    /**
     * Language labels
     *
     * @type {{ctrl: {play: string, stop: string, progress: string, pause: string}}}
     */
    const l18n = {
        ctrl: {
            play: 'Text vorlesen',
            pause: 'Pause',
            progress: 'Fortschritt',
            stop: 'Schließen'
        }
    };


    let voices = [];
    let speechUtterance = null;

    // Sentence splitting
    const initSplit = /(\S.+?[.!?\u203D\u2E18\u203C\u2047-\u2049])(?=\s+|$)/g;
    const hasSomething = /\S/;
    const isAcronym = /[ .][A-Z]\.? *$/i;
    const hasEllipse = /(?:\u2026|\.{2,}) *$/;
    const newLine = /((?:\r?\n|\r)+)/; // Match different new-line formats
    const hasLetter = /[a-z0-9\u00C0-\u00FF\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]/i;
    const startWhitespace = /^\s+/;

    /**
     * Naiive splitting
     *
     * @param {String} text Text
     *
     * @returns {[]} Sentences
     */
    function naiiveSplit(text) {
        const all = [];
        const lines = text.split(newLine);
        for (let i = 0; i < lines.length; ++i) {
            const arr = lines[i].split(initSplit);
            for (let o = 0; o < arr.length; ++o) {
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
    function isSentence(str, abbrevs) {
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

        const txt = str.replace(/[.!?\u203D\u2E18\u203C\u2047-\u2049] *$/, '');
        const words = txt.split(' ');
        const lastWord = words[words.length - 1].toLowerCase();

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
    const splitSentences = function (text) {
        // let abbrevs = world.cache.abbreviations
        const abbrevs = {};

        text = text || '';
        text = String(text);
        const sentences = [];

        // First do a greedy-split..
        const chunks = [];

        // Ensure it 'smells like' a sentence
        if (!text || typeof text !== 'string' || hasSomething.test(text) === false) {
            return sentences;
        }

        // cleanup unicode-spaces
        text = text.replace('\xa0', ' ');

        // Start somewhere:
        const splits = naiiveSplit(text);

        // Filter-out the crap ones
        for (let i = 0; i < splits.length; ++i) {
            const s = splits[i];
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
        for (let i = 0; i < chunks.length; ++i) {
            const c = chunks[i];
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
        for (let i = 1; i < sentences.length; i += 1) {
            const ws = sentences[i].match(startWhitespace);
            if (ws !== null) {
                sentences[i - 1] += ws[0];
                sentences[i] = sentences[i].replace(startWhitespace, '');
            }
        }
        return sentences;
    }

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
        this.options = options;
        this._baseLanguage = this._determineLanguage(this.element);
        this._utterances = [];
        this._text = (this.element.textContent || '').trim();
        this._length = this._text.length;
        this._progress = 0;
        this._player = null;
        this._controls = {};
        this._buildPlayer();
        this._injectPlayer();
    }

    /**
     * Determine element language
     *
     * @param {Element} element Element
     * @private
     */
    Speakable.prototype._determineLanguage = function (element) {
        const lang = element.lang;
        return lang || (element.parentNode ? this._determineLanguage(element.parentNode) : null);
    }

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
    }

    /**
     * Start playing
     *
     * @param {Event} e Event
     */
    Speakable.prototype.play = function (e) {
        this._player.classList.add('spkbl-player--active');
        this._player.classList.remove('spkbl-player--inactive');
        this._controls.pause.focus();

        speechSynthesis.cancel();
        speechUtterance.text = this._text;
        speechUtterance.onend = this.stop.bind(this);
        // speechUtterance.onboundary = e => console.log(e);
        speechUtterance.onboundary = this.boundary.bind(this);
        speechSynthesis.speak(speechUtterance);
    }

    /**
     * Boundary handler
     *
     * @param {SpeechSynthesisEvent} e Event
     */
    Speakable.prototype.boundary = function (e) {
        this._progress = Math.round(100 * e.charIndex / this._length);
        this._controls.progress.value = this._progress;
        this._controls.progress.textContent = `${this._progress}%`;
        console.log(this._progress, e.name, this._text.substr(e.charIndex, e.charLength));
    }

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
    }

    /**
     * Stop playing
     *
     * @param {Event} e Event
     */
    Speakable.prototype.stop = function (e) {
        this._player.classList.add('spkbl-player--inactive');
        this._player.classList.remove('spkbl-player--active');
        this._player.classList.remove('spkbl-player--paused');
        this._controls.play.focus();

        speechSynthesis.cancel();
    }

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
    }

    /**
     * Initialize all speakables
     *
     * @param {Object} options Options
     *
     * @returns {Array} Speakables
     */
    Speakable.init = function (options = {}) {
        // If the Web Speech API is supported
        if ('SpeechSynthesisUtterance' in w) {
            speechUtterance = new SpeechSynthesisUtterance();

            // function isPreferredVoice(voice) {
            //     return ["Google US English", "Microsoft Jessa Online"].any(preferredVoice =>
            //         voice.name.startsWith(preferredVoice)
            //     );
            // }

            speechSynthesis.addEventListener('voiceschanged', () => {
                voices = speechSynthesis.getVoices();
                // speechUtterance.voice = voices.find(isPreferredVoice);
                speechUtterance.voice = voices.find(v => true);
                speechUtterance.lang = "de-DE";
                speechUtterance.volume = 1;
                speechUtterance.pitch = 1;
                speechUtterance.rate = 1;
            });

            const opts = Object.assign(defaultOptions, options);
            const selector = opts.selector || '';
            return selector.length ? Array.from(d.querySelectorAll(selector)).map(s => new Speakable(s, opts)) : [];
        }

        return [];
    }

    if (typeof exports !== 'undefined') {
        exports.Speakable = Speakable;
    } else {
        w.Speakable = Speakable;
    }
})(typeof global !== 'undefined' ? global : window, document);


