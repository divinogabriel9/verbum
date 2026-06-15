/**
 * Stitch-inspired login background: interactive dot grid + aurora nebula.
 * Dot grid logic adapted from stitch.withgoogle.com (DotGridBackground).
 */
(function () {
  "use strict";

  var GRID = 10;
  var DOT = 0.5;
  var GLOW_R = 120;
  var FADE_MS = 800;
  var MASK_NONE = "linear-gradient(transparent, transparent)";
  var AURORA_COLORS = ["#9154E7", "#6056F0", "#40D9C6", "#4285F4"];

  function dotPattern(color) {
    return "radial-gradient(circle, " + color + " " + DOT + "px, transparent " + DOT + "px)";
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isDarkTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function themeColors() {
    return isDarkTheme()
      ? { dot: "#666", glow: "#fff" }
      : { dot: "#ccc", glow: "#000" };
  }

  /* ── Dot grid (mouse-reactive glow) ── */
  function initDotGrid(root) {
    var base = document.createElement("div");
    var glow = document.createElement("div");
    var mouse = null;
    var raf = null;
    var colors = themeColors();

    function applyLayerStyle(el, color, isGlow) {
      el.style.position = "absolute";
      el.style.inset = "0";
      el.style.backgroundImage = dotPattern(color);
      el.style.backgroundSize = GRID + "px " + GRID + "px";
      el.style.backgroundPosition = GRID / 2 + "px " + GRID / 2 + "px";
      el.style.pointerEvents = "none";
      if (isGlow) {
        el.style.maskImage = MASK_NONE;
        el.style.webkitMaskImage = MASK_NONE;
        el.style.opacity = "0";
      }
    }

    applyLayerStyle(base, colors.dot, false);
    applyLayerStyle(glow, colors.glow, true);

    root.appendChild(base);
    root.appendChild(glow);

    function paintGlow() {
      if (!mouse || mouse.alpha <= 0.01) {
        glow.style.maskImage = MASK_NONE;
        glow.style.webkitMaskImage = MASK_NONE;
        glow.style.opacity = "0";
        return;
      }
      var n = Math.min(mouse.alpha, 1);
      var mask =
        "radial-gradient(circle " +
        GLOW_R +
        "px at " +
        mouse.x +
        "px " +
        mouse.y +
        "px, rgba(0,0,0," +
        n +
        ") 0%, rgba(0,0,0," +
        n * 0.8 +
        ") 25%, rgba(0,0,0," +
        n * 0.4 +
        ") 55%, transparent 100%)";
      glow.style.opacity = "1";
      glow.style.maskImage = mask;
      glow.style.webkitMaskImage = mask;
    }

    function tick() {
      if (!mouse) {
        raf = null;
        return;
      }
      var elapsed = performance.now() - mouse.lastMove;
      if (elapsed > 0) mouse.alpha = 1 - Math.min(elapsed / FADE_MS, 1);
      paintGlow();
      if (mouse.alpha > 0.01) {
        raf = requestAnimationFrame(tick);
      } else {
        mouse = null;
        raf = null;
        paintGlow();
      }
    }

    function onMove(e) {
      var rect = root.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return;
      }
      mouse = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        alpha: 1,
        lastMove: performance.now(),
      };
      if (!raf) raf = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove, { passive: true });

    function onThemeChange() {
      colors = themeColors();
      base.style.backgroundImage = dotPattern(colors.dot);
      glow.style.backgroundImage = dotPattern(colors.glow);
    }

    return {
      destroy: function () {
        window.removeEventListener("mousemove", onMove);
        if (raf) cancelAnimationFrame(raf);
      },
      onThemeChange: onThemeChange,
    };
  }

  /* ── Aurora nebula canvas ── */
  function initAuroraCanvas(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return function () {};

    var mouse = { x: 0.5, y: 0.5 };
    var target = { x: 0.5, y: 0.5 };
    var t0 = performance.now();
    var raf = null;
    var reduced = prefersReducedMotion();

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now) {
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;
      if (!w || !h) return;

      var elapsed = (now - t0) * 0.001;
      mouse.x += (target.x - mouse.x) * 0.04;
      mouse.y += (target.y - mouse.y) * 0.04;

      ctx.clearRect(0, 0, w, h);

      var dark = isDarkTheme();
      ctx.fillStyle = dark ? "#191a1f" : "#eef2f6";
      ctx.fillRect(0, 0, w, h);

      var blobs = [
        { cx: 0.52 + mouse.x * 0.07, cy: 0.28 + mouse.y * 0.04, r: 0.55, phase: 0, color: AURORA_COLORS[0] },
        { cx: 0.38 + mouse.x * 0.05, cy: 0.62 + mouse.y * 0.03, r: 0.48, phase: 1.8, color: AURORA_COLORS[1] },
        { cx: 0.68 + mouse.x * 0.06, cy: 0.55 + mouse.y * 0.05, r: 0.42, phase: 3.1, color: AURORA_COLORS[2] },
        { cx: 0.45 + mouse.x * 0.04, cy: 0.4 + mouse.y * 0.04, r: 0.38, phase: 4.5, color: AURORA_COLORS[3] },
      ];

      ctx.globalCompositeOperation = dark ? "screen" : "multiply";

      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var ox = reduced ? 0 : Math.sin(elapsed * 0.21 + b.phase) * 0.06;
        var oy = reduced ? 0 : Math.cos(elapsed * 0.17 + b.phase) * 0.05;
        var x = (b.cx + ox) * w;
        var y = (b.cy + oy) * h;
        var radius = b.r * Math.max(w, h);
        var g = ctx.createRadialGradient(x, y, 0, x, y, radius);
        var alpha = dark ? 0.42 : 0.22;
        g.addColorStop(0, hexToRgba(b.color, alpha));
        g.addColorStop(0.45, hexToRgba(b.color, alpha * 0.35));
        g.addColorStop(1, hexToRgba(b.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalCompositeOperation = "source-over";

      /* Film grain */
      if (!reduced) {
        paintGrain(ctx, w, h, elapsed, dark ? 0.06 : 0.04);
      }
    }

    function loop(now) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    function onMove(e) {
      target.x = e.clientX / window.innerWidth;
      target.y = e.clientY / window.innerHeight;
    }

    function onResize() {
      resize();
    }

    resize();
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);

    return function () {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }

  function hexToRgba(hex, a) {
    var h = hex.replace("#", "");
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  var grainCanvas = null;
  function paintGrain(ctx, w, h, t, opacity) {
    if (!grainCanvas) {
      grainCanvas = document.createElement("canvas");
      grainCanvas.width = 256;
      grainCanvas.height = 256;
      var gctx = grainCanvas.getContext("2d");
      var img = gctx.createImageData(256, 256);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = (Math.random() * 255) | 0;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      gctx.putImageData(img, 0, 0);
    }
    var offset = (t * 40) % 256;
    ctx.save();
    ctx.globalAlpha = opacity;
    for (var x = -256; x < w + 256; x += 256) {
      for (var y = -256; y < h + 256; y += 256) {
        ctx.drawImage(grainCanvas, x + offset, y);
      }
    }
    ctx.restore();
  }

  /* ── Boot ── */
  function init() {
    var auroraCanvas = document.getElementById("auth-aurora-canvas");
    var dotRoot = document.getElementById("auth-dot-grid");
    if (!auroraCanvas || !dotRoot) return;

    var dotGrid = initDotGrid(dotRoot);
    var stopAurora = initAuroraCanvas(auroraCanvas);

    function onThemeChange() {
      dotGrid.onThemeChange();
    }

    var themeObs = new MutationObserver(onThemeChange);
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-dark-variant"],
    });
    window.addEventListener("verbum-theme-change", onThemeChange);

    window.addEventListener(
      "pagehide",
      function () {
        themeObs.disconnect();
        window.removeEventListener("verbum-theme-change", onThemeChange);
        dotGrid.destroy();
        stopAurora();
      },
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
