!function(s,r){"use strict";var i={selector:".spkbl",insert:"before"},e={play:"Text vorlesen",pause:"Pause",progress:"Fortschritt",stop:"Schließen"},o=[],l=null;function n(e,t){this.element=e,this.options=t,this._text=(this.element.textContent||"").trim(),this._length=this._text.length,this._progress=0,this._player=null,this._controls={},this._buildPlayer(),this._injectPlayer()}n.prototype._buildPlayer=function(){this._player=r.createElement("div"),this._player.className="spkbl-player spkbl-player--inactive",this._player.role="group",this._controls.play=r.createElement("button"),this._controls.play.type="button",this._controls.play.className="spkbl-ctrl spkbl-ctrl--play",this._controls.play.addEventListener("click",this.play.bind(this)),this._controls.play.appendChild(r.createTextNode(e.play)),this._player.appendChild(this._controls.play),this._controls.pause=r.createElement("button"),this._controls.pause.type="button",this._controls.pause.className="spkbl-ctrl spkbl-ctrl--pause",this._controls.pause.addEventListener("click",this.pause.bind(this)),this._controls.pause.appendChild(r.createTextNode(e.pause)),this._controls.pause.setAttribute("aria-pressed","false"),this._player.appendChild(this._controls.pause),this._controls.progress=r.createElement("input"),this._controls.progress.type="range",this._controls.progress.className="spkbl-ctrl spkbl-ctrl--progress",this._controls.progress.min="0",this._controls.progress.max="100",this._controls.progress.value="0",this._controls.progress.className="spkbl-ctrl spkbl-ctrl--progress",this._controls.progress.addEventListener("change",this.progress.bind(this)),this._controls.progress.setAttribute("aria-label",e.progress),this._controls.progress.setAttribute("readonly","true"),this._player.appendChild(this._controls.progress),this._controls.stop=r.createElement("button"),this._controls.stop.type="button",this._controls.stop.className="spkbl-ctrl spkbl-ctrl--stop",this._controls.stop.addEventListener("click",this.stop.bind(this)),this._controls.stop.appendChild(r.createTextNode(e.stop)),this._player.appendChild(this._controls.stop)},n.prototype.play=function(e){this._player.classList.add("spkbl-player--active"),this._player.classList.remove("spkbl-player--inactive"),this._controls.pause.focus(),speechSynthesis.cancel(),l.text=this._text,l.onend=this.stop.bind(this),l.onboundary=this.boundary.bind(this),speechSynthesis.speak(l)},n.prototype.boundary=function(e){this._progress=Math.round(100*e.charIndex/this._length),this._controls.progress.value=this._progress,console.log(this._progress,e.name,this._text.substr(e.charIndex,e.charLength))},n.prototype.pause=function(e){speechSynthesis.speaking&&(speechSynthesis.paused?(speechSynthesis.resume(),this._player.classList.remove("spkbl-player--paused"),this._controls.pause.setAttribute("aria-pressed","false")):(speechSynthesis.pause(),this._player.classList.add("spkbl-player--paused"),this._controls.pause.setAttribute("aria-pressed","true")))},n.prototype.progress=function(e){},n.prototype.stop=function(e){this._player.classList.add("spkbl-player--inactive"),this._player.classList.remove("spkbl-player--active"),this._player.classList.remove("spkbl-player--paused"),this._controls.play.focus(),speechSynthesis.cancel()},n.prototype._injectPlayer=function(){if("function"!=typeof this.options.insert)switch(this.options.insert){case"before":this.element.parentNode.insertBefore(this._player,this.element);break;case"after":this.element.parentNode.insertBefore(this._player,this.element.nextSibling);break;default:this.element.insertBefore(this._player,this.element.firstChild)}else this.options.insert(this.element,this._player)},n.init=function(e){if(void 0===e&&(e={}),"SpeechSynthesisUtterance"in s){l=new SpeechSynthesisUtterance,speechSynthesis.addEventListener("voiceschanged",function(){o=speechSynthesis.getVoices(),l.voice=o.find(function(e){return!0}),l.lang="de-DE",l.volume=1,l.pitch=1,l.rate=1});var t=Object.assign(i,e),e=t.selector||"";return e.length?Array.from(r.querySelectorAll(e)).map(function(e){return new n(e,t)}):[]}return[]},"undefined"!=typeof exports?exports.Speakable=n:s.Speakable=n}("undefined"!=typeof global?global:window,document);