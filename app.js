// Ensure viewport remains at 100% on rotation/resize by re-applying the meta
(function ensureViewport() {
  function setViewport() {
    try {
      var m = document.querySelector('meta[name="viewport"]');
      if (!m) {
        m = document.createElement("meta");
        m.name = "viewport";
        document.head.appendChild(m);
      }
      m.content =
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0";
    } catch (e) {}
  }

  // Only force viewport + scroll-to-top on orientation change
  window.addEventListener(
    "orientationchange",
    function () {
      // small delay to let browser complete orientation/layout
      setTimeout(function () {
        try {
          window.scrollTo(0, 0);
        } catch (e) {}
        setViewport();
      }, 120);
    },
    { passive: true }
  );

  // Resize can fire frequently on mobile when the address bar shows/hides.
  // Ignore small height changes (address bar) and only reapply viewport
  // when the innerHeight changes significantly.
  var _lastInnerH = window.innerHeight;
  window.addEventListener(
    "resize",
    function () {
      var newH = window.innerHeight;
      if (Math.abs(newH - _lastInnerH) < 120) return; // ignore small changes (address bar)
      _lastInnerH = newH;
      setTimeout(setViewport, 120);
    },
    { passive: true }
  );

  // run once on load
  setViewport();
})();

// Vue app
(function initVueApp() {
  if (!window.Vue || !window.Vue.createApp) return;

  var createApp = window.Vue.createApp;

  createApp({
    data: function () {
      return {
        dataCerimoniaGiorno: "DOMENICA",
        dataCerimoniaData: "11 OTTOBRE 2026",
        luogoCerimonia: "Chiesa di San Sisto",
        linkCerimonia: "https://maps.app.goo.gl/Vh65xmkwGpjVCPsn8",
        indirizzoCerimonia: "Piazza Francesco Buonamici 1, Pisa",
        oraCerimonia: "Ore 11:30",
        luogoRicevimento: "Valle di Badia",
        linkRicevimento: "https://maps.app.goo.gl/8kzoFq4XTFYPheQ4A",
        indirizzoRicevimento: "Via di Badia 24, Buti (PI)",
        linkLista: "https://www.rinascentelistanozze.it/ListaNozze/it/AreaDonatori",
        codiceLista: "451019888",
        passwordLista: "ElenaClaudio2026!",
        iban: "IT1900366901600282545018977",
        linkMappaParcheggio: "parcheggi.html",
        copiedCodice: false,
        copiedPassword: false,
        copiedIban: false,
        countdown: { giorni: "00", ore: "00", minuti: "00", secondi: "00" },
        matrimonioPassato: false,
        _countdownInterval: null,
      };
    },
    mounted: function () {
      var target = new Date(2026, 9, 11, 11, 30);
      var pad = function (n) {
        return String(n).padStart(2, "0");
      };
      var tick = () => {
        var now = new Date();
        var diff = target - now;
        if (diff <= 0) {
          this.matrimonioPassato = true;
          clearInterval(this._countdownInterval);
          return;
        }
        var giorni = Math.floor(diff / 86400000);
        var ore = Math.floor((diff % 86400000) / 3600000);
        var minuti = Math.floor((diff % 3600000) / 60000);
        var secondi = Math.floor((diff % 60000) / 1000);
        this.countdown = {
          giorni: pad(giorni),
          ore: pad(ore),
          minuti: pad(minuti),
          secondi: pad(secondi),
        };
      };
      tick();
      this._countdownInterval = setInterval(tick, 1000);
    },
    unmounted: function () {
      clearInterval(this._countdownInterval);
    },
    methods: {
      copiaCodice: function () {
        navigator.clipboard
          .writeText(this.codiceLista)
          .then(() => this._setCopiedFlag("Codice"))
          .catch(() => alert("Errore nella copia del Codice Lista"));
      },
      copiaPassword: function () {
        navigator.clipboard
          .writeText(this.passwordLista)
          .then(() => this._setCopiedFlag("Password"))
          .catch(() => alert("Errore nella copia della Password Lista"));
      },
      copiaIBAN: function () {
        navigator.clipboard
          .writeText(this.iban)
          .then(() => this._setCopiedFlag("Iban"))
          .catch(() => alert("Errore nella copia dell'IBAN"));
      },
      _setCopiedFlag: function (key) {
        var flagName = "copied" + key;
        var timeoutName = "_copyTimeout" + key;
        this[flagName] = true;
        if (this[timeoutName]) {
          clearTimeout(this[timeoutName]);
        }
        this[timeoutName] = setTimeout(() => {
          this[flagName] = false;
        }, 1600);
      },
    },
    components: {
      Minigame: {
        template:
          '<canvas ref="canvas" class="game-canvas" role="img" aria-label="Gioco: minigioco del matrimonio"></canvas>',
        mounted: function () {
          var canvas = this.$refs.canvas;
          canvas.width = canvas.clientWidth;
          canvas.height = canvas.clientHeight;
          if (typeof initGame === "function") initGame(canvas);
        },
      },
    },
  }).mount("#app");
})();

// Simple scroll-reveal effect for sections and footer
(function initReveal() {
  function run() {
    var revealEls = document.querySelectorAll(".reveal");
    if (!revealEls.length) return;

    function makeVisible(el) {
      el.classList.add("is-visible");
    }

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              makeVisible(entry.target);
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.18 }
      );

      revealEls.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      revealEls.forEach(makeVisible);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();

// Footer walk cycle — starts when footer becomes visible
(function initFooterWalk() {
  var sposoCycles = [
    "img/sposo-1.png",
    "img/sposo-2.png",
    "img/sposo-3.png",
    "img/sposo-2.png",
  ];
  var sposaCycles = ["img/sposa-1.png", "img/sposa-2.png"];
  var si = 0,
    bi = 0;

  function startWalk() {
    var sposo = document.getElementById("footer-sposo");
    var sposa = document.getElementById("footer-sposa");
    if (!sposo || !sposa) return;
    var interval = setInterval(function () {
      si = (si + 1) % sposoCycles.length;
      bi = (bi + 1) % sposaCycles.length;
      sposo.src = sposoCycles[si];
      sposa.src = sposaCycles[bi];
    }, 150);
    setTimeout(function () {
      clearInterval(interval);
      sposo.src = "img/sposo-2.png";
      sposa.src = "img/sposa-2.png";
    }, 5000);
  }

  function waitForVisible() {
    var footer = document.querySelector("footer.reveal");
    if (!footer) return;
    if (footer.classList.contains("is-visible")) {
      startWalk();
      return;
    }
    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.target.classList.contains("is-visible")) {
          obs.disconnect();
          startWalk();
        }
      });
    });
    obs.observe(footer, { attributes: true, attributeFilter: ["class"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForVisible);
  } else {
    waitForVisible();
  }
})();

