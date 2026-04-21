(function () {
  'use strict';

  // 逐字顯示文字，支援標點停頓、跳過、完成回呼
  class Typewriter {
    constructor(element) {
      this.el = element;
      this.timer = null;
      this.fullText = '';
      this.index = 0;
      this.onDone = null;
      this.speed = 40;
      this.pauseChars = new Set(['，', '。', '！', '？', '；', '：', '、', '⋯', ',', '.', '!', '?']);
    }

    play(text, onDone) {
      this.stop();
      this.fullText = text || '';
      this.index = 0;
      this.onDone = onDone || null;
      this.el.innerHTML = '<span class="caret"></span>';
      this._tick();
    }

    _tick() {
      if (this.index >= this.fullText.length) {
        this._finish();
        return;
      }
      const ch = this.fullText[this.index];
      this.index++;
      this.el.innerHTML = this.fullText.slice(0, this.index) + '<span class="caret"></span>';
      const delay = this.pauseChars.has(ch) ? this.speed * 6 : this.speed;
      this.timer = setTimeout(() => this._tick(), delay);
    }

    skip() {
      if (this.isDone()) return false;
      this.stop();
      this.index = this.fullText.length;
      this.el.innerHTML = this.fullText;
      this._finish();
      return true;
    }

    _finish() {
      this.stop();
      this.el.innerHTML = this.fullText;
      if (typeof this.onDone === 'function') {
        const cb = this.onDone;
        this.onDone = null;
        cb();
      }
    }

    stop() {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }

    isDone() {
      return this.index >= this.fullText.length;
    }
  }

  window.Typewriter = Typewriter;
})();
