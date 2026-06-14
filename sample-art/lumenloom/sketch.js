window.ArtNamespace = {
  setup(ctx) {
    const { p5 } = ctx;
    p5.createCanvas(1000, 1000);
    p5.noLoop();
  },

  draw(ctx) {
    const { p5, params, rand } = ctx;
    p5.background(params.background);
    p5.noFill();

    const cx = p5.width / 2;
    const cy = p5.height / 2;
    const dark = String(params.background).startsWith("#0") || String(params.background).startsWith("#1");
    const veil = dark ? 34 : 22;

    p5.blendMode(p5.BLEND);
    p5.strokeWeight(params.lineWeight);

    if (params.glow) {
      p5.drawingContext.shadowColor = params.threadColor;
      p5.drawingContext.shadowBlur = 24;
    }

    for (let orbit = 0; orbit < params.orbitCount; orbit++) {
      const radius = 92 + orbit * (360 / params.orbitCount);
      const phase = rand() * Math.PI * 2;
      const wobble = 16 + rand() * 70 * params.turbulence;

      p5.stroke(orbit % 2 === 0 ? params.threadColor : params.accentColor);
      p5.beginShape();
      for (let step = 0; step <= 240; step++) {
        const t = (step / 240) * Math.PI * 2;
        const wave = Math.sin(t * (2 + orbit) + phase) * wobble;
        const lace = Math.cos(t * params.orbitCount - phase) * wobble * 0.45;
        const x = cx + Math.cos(t) * (radius + wave) + Math.cos(t * 3) * lace;
        const y = cy + Math.sin(t) * (radius - wave) + Math.sin(t * 2) * lace;
        p5.curveVertex(x, y);
      }
      p5.endShape();
    }

    p5.drawingContext.shadowBlur = 0;
    p5.strokeWeight(Math.max(0.5, params.lineWeight * 0.55));

    for (let i = 0; i < params.weaveCount; i++) {
      const a = (i / params.weaveCount) * Math.PI * 2;
      const offset = (rand() - 0.5) * params.turbulence * Math.PI;
      const inner = 80 + rand() * 130;
      const outer = 340 + rand() * 120;
      const twist = 0.4 + rand() * 1.6;

      const x1 = cx + Math.cos(a + offset) * inner;
      const y1 = cy + Math.sin(a + offset) * inner;
      const x2 = cx + Math.cos(a + Math.PI * twist - offset) * outer;
      const y2 = cy + Math.sin(a + Math.PI * twist - offset) * outer;

      const c = i % 3 === 0 ? params.accentColor : params.threadColor;
      p5.stroke(c + veil.toString(16).padStart(2, "0"));
      p5.line(x1, y1, x2, y2);
    }

    p5.blendMode(p5.BLEND);
    p5.noStroke();
    p5.fill(params.accentColor);
    p5.circle(cx, cy, 12 + params.orbitCount * 2);
  },

  features(ctx) {
    const { params } = ctx;
    return {
      Palette: params.threadColor + " / " + params.accentColor,
      Loom: params.weaveCount > 76 ? "Dense" : params.weaveCount > 52 ? "Measured" : "Open",
      Orbits: String(params.orbitCount),
      Field: params.turbulence > 0.45 ? "Turbulent" : params.turbulence > 0.22 ? "Rippling" : "Still",
      Glow: params.glow ? "On" : "Off"
    };
  }
};
