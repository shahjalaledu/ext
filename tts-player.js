(function () {
  if (!("speechSynthesis" in window)) {
    console.warn("TTS: speechSynthesis is not supported in this browser.");
    return;
  }

  const synth = window.speechSynthesis;

  function findArticleElement() {
    const byId = document.getElementById("article-content");
    if (byId) return byId;

    const article = document.querySelector("article");
    if (article) return article;

    const main = document.querySelector("main");
    if (main) return main;

    return document.body;
  }

  function getArticleText(articleEl) {
    if (!articleEl) return "";
    return articleEl.textContent.trim();
  }

  function createTtsPlayer() {
    const container = document.createElement("section");
    container.className = "tts-player";
    container.setAttribute("aria-label", "Text to Speech Player");

    container.innerHTML = `
      <div class="tts-row tts-controls">
        <button type="button" id="tts-play">Play</button>
        <button type="button" id="tts-pause">Pause</button>
        <button type="button" id="tts-resume">Resume</button>
        <button type="button" id="tts-stop">Stop</button>
      </div>

      <div class="tts-row">
        <span class="tts-label">Speed:</span>
        <div class="tts-slider">
          <input type="range" id="tts-rate" min="0.5" max="2.0" step="0.1" value="1" />
        </div>
        <span id="tts-rate-value" class="tts-label">1.0x</span>
      </div>

      <div class="tts-row">
        <span class="tts-label">Seek:</span>
        <div class="tts-slider">
          <input type="range" id="tts-seek" min="0" max="100" step="1" value="0" />
        </div>
        <span id="tts-seek-value" class="tts-label">0%</span>
      </div>

      <div class="tts-row">
        <span class="tts-label">Voice:</span>
        <select id="tts-voice" class="tts-select"></select>
      </div>

      <div id="tts-status" class="tts-status">
        Ready. Click "Play" to read this page aloud.
      </div>
    `;

    const main = document.querySelector("main");
    if (main) {
      main.insertBefore(container, main.firstChild);
    } else {
      document.body.insertBefore(container, document.body.firstChild);
    }

    if (!document.querySelector("style[data-tts-player]")) {
      const style = document.createElement("style");
      style.setAttribute("data-tts-player", "true");
      style.textContent = `
        .tts-player {
          border-radius: 0.75rem;
          border: 1px solid #e5e7eb;
          padding: 0.8rem 1rem;
          background: #f3f4f6;
          margin: 0.8rem auto 1.2rem;
          max-width: 900px;
        }
        .tts-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem 0.75rem;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .tts-controls button {
          padding: 0.35rem 0.7rem;
          border-radius: 0.4rem;
          border: 1px solid #d1d5db;
          background: #ffffff;
          cursor: pointer;
          font-size: 0.85rem;
        }
        .tts-controls button:hover {
          background: #e5e7eb;
        }
        .tts-label {
          font-size: 0.8rem;
          color: #4b5563;
          margin-right: 0.25rem;
        }
        .tts-slider {
          flex: 1;
          min-width: 120px;
        }
        .tts-slider input[type="range"] {
          width: 100%;
        }
        .tts-select {
          min-width: 140px;
          font-size: 0.85rem;
          padding: 0.2rem 0.3rem;
        }
        .tts-status {
          font-size: 0.78rem;
          color: #6b7280;
          margin-top: 0.3rem;
        }
      `;
      document.head.appendChild(style);
    }

    return container;
  }

  function init() {
    const articleEl = findArticleElement();
    if (!articleEl) {
      console.warn("TTS: no article/main/body found.");
      return;
    }

    createTtsPlayer();

    const playBtn = document.getElementById("tts-play");
    const pauseBtn = document.getElementById("tts-pause");
    const resumeBtn = document.getElementById("tts-resume");
    const stopBtn = document.getElementById("tts-stop");
    const rateInput = document.getElementById("tts-rate");
    const rateValue = document.getElementById("tts-rate-value");
    const seekInput = document.getElementById("tts-seek");
    const seekValue = document.getElementById("tts-seek-value");
    const voiceSelect = document.getElementById("tts-voice");
    const statusEl = document.getElementById("tts-status");

    if (!playBtn || !pauseBtn || !resumeBtn || !stopBtn) {
      console.warn("TTS: controls not found.");
      return;
    }

    let voices = [];
    let currentText = "";
    let currentUtterance = null;
    let currentIndex = 0;

    function loadVoices() {
      voices = synth.getVoices();
      voiceSelect.innerHTML = "";

      if (!voices.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No voices available";
        voiceSelect.appendChild(option);
        return;
      }

      voices.forEach((v, i) => {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = `${v.name} (${v.lang})`;
        voiceSelect.appendChild(option);
      });

      const pageLang = document.documentElement.lang || "en";
      const firstMatch = voices.findIndex(v =>
        v.lang.toLowerCase().startsWith(pageLang.toLowerCase())
      );
      if (firstMatch >= 0) {
        voiceSelect.value = String(firstMatch);
      }
    }

    loadVoices();
    if (typeof speechSynthesis !== "undefined" && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    function speakFromCurrentIndex() {
      if (!currentText) {
        currentText = getArticleText(articleEl);
        currentIndex = 0;
      }
      if (!currentText) {
        statusEl.textContent = "No text to read.";
        return;
      }

      synth.cancel();
      currentUtterance = new SpeechSynthesisUtterance(currentText.slice(currentIndex));

      const selectedVoiceIndex = parseInt(voiceSelect.value, 10);
      if (!isNaN(selectedVoiceIndex) && voices[selectedVoiceIndex]) {
        currentUtterance.voice = voices[selectedVoiceIndex];
      }

      currentUtterance.rate = parseFloat(rateInput.value) || 1.0;

      currentUtterance.onstart = () => {
        statusEl.textContent = "Reading...";
      };
      currentUtterance.onend = () => {
        if (!synth.speaking && !synth.pending) {
          currentIndex = 0;
          seekInput.value = 0;
          seekValue.textContent = "0%";
          statusEl.textContent = "Finished reading.";
        }
      };
      currentUtterance.onerror = (e) => {
        console.error("TTS error:", e);
        statusEl.textContent = "Error during speech synthesis.";
      };

      currentUtterance.onboundary = (event) => {
        if (event.charIndex != null && currentText.length) {
          currentIndex = event.charIndex;
          const percent = Math.round((currentIndex / currentText.length) * 100);
          seekInput.value = percent;
          seekValue.textContent = percent + "%";
        }
      };

      synth.speak(currentUtterance);
    }

    playBtn.addEventListener("click", () => {
      currentText = getArticleText(articleEl);
      if (!currentText) {
        statusEl.textContent = "No text to read.";
        return;
      }
      speakFromCurrentIndex();
    });

    pauseBtn.addEventListener("click", () => {
      if (synth.speaking && !synth.paused) {
        synth.pause();
        statusEl.textContent = "Paused.";
      }
    });

    resumeBtn.addEventListener("click", () => {
      if (synth.paused) {
        synth.resume();
        statusEl.textContent = "Resumed reading.";
      }
    });

    stopBtn.addEventListener("click", () => {
      synth.cancel();
      currentIndex = 0;
      seekInput.value = 0;
      seekValue.textContent = "0%";
      statusEl.textContent = "Stopped.";
    });

    rateInput.addEventListener("input", () => {
      const val = parseFloat(rateInput.value).toFixed(1);
      rateValue.textContent = val + "x";
      if (currentUtterance) {
        currentUtterance.rate = parseFloat(val);
      }
    });

    seekInput.addEventListener("change", () => {
      const percent = parseInt(seekInput.value, 10) || 0;
      seekValue.textContent = percent + "%";

      if (!currentText) {
        currentText = getArticleText(articleEl);
        if (!currentText) return;
      }

      const idx = Math.round((percent / 100) * currentText.length);
      currentIndex = idx;

      if (synth.speaking || synth.paused) {
        synth.cancel();
        speakFromCurrentIndex();
      }
    });

    voiceSelect.addEventListener("change", () => {
      if (synth.speaking || synth.paused) {
        synth.cancel();
        speakFromCurrentIndex();
      }
    });

    statusEl.textContent = 'Ready. Click "Play" to read this page aloud.';
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
