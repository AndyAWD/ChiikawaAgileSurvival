(function () {
  'use strict';

  const SCENES = ['title', 'map', 'slide'];

  class SceneManager {
    constructor() {
      this.current = 'title';
      this.listeners = {};
    }

    show(name) {
      if (!SCENES.includes(name)) return;
      const prev = this.current;
      SCENES.forEach(s => {
        const el = document.getElementById('scene-' + s);
        if (!el) return;
        el.classList.toggle('active', s === name);
      });
      this.current = name;
      this._emit('change', { from: prev, to: name });
    }

    on(event, fn) {
      (this.listeners[event] = this.listeners[event] || []).push(fn);
    }

    _emit(event, data) {
      (this.listeners[event] || []).forEach(fn => fn(data));
    }
  }

  window.SceneManager = SceneManager;
})();
