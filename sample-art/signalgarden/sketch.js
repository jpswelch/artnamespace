window.ArtNamespace = {
  setup(ctx) {
    const { p5 } = ctx;
    p5.createCanvas(1000, 1000);
    p5.noLoop();
    p5.angleMode(p5.RADIANS);
  },

  draw(ctx) {
    const { p5, params, rand, tokenId } = ctx;
    p5.background(params.background);
    p5.noFill();

    const dark = params.nightMode || String(params.background).startsWith("#0") || String(params.background).startsWith("#1");
    const margin = 112;
    const size = params.gardenSize;
    const cell = (p5.width - margin * 2) / Math.max(1, size - 1);
    const pulseAlpha = dark ? 72 : 42;
    const stemAlpha = dark ? 210 : 190;

    p5.strokeWeight(1);
    p5.stroke(withAlpha(params.signalColor, pulseAlpha));
    for (let wave = 0; wave < params.waveCount; wave++) {
      const radius = 120 + wave * (380 / params.waveCount);
      const drift = (rand() - 0.5) * 36;
      p5.circle(p5.width / 2 + drift, p5.height / 2 - drift, radius * 2);
    }

    for (let gx = 0; gx < size; gx++) {
      for (let gy = 0; gy < size; gy++) {
        const skip = rand() < 0.18;
        if (skip) continue;

        const baseX = margin + gx * cell + (rand() - 0.5) * cell * params.jitter;
        const baseY = margin + gy * cell + (rand() - 0.5) * cell * params.jitter;
        const stemLength = 42 + rand() * 88;
        const lean = (rand() - 0.5) * 58 * params.jitter;
        const bloomX = baseX + lean;
        const bloomY = baseY - stemLength;
        const bloomRadius = (12 + rand() * 26) * params.petalScale;
        const petals = 5 + Math.floor(rand() * 6);
        const phase = rand() * Math.PI * 2;

        p5.stroke(withAlpha(params.stemColor, stemAlpha));
        p5.strokeWeight(1.2 + rand() * 2.2);
        p5.bezier(baseX, baseY, baseX + lean * 0.2, baseY - stemLength * 0.4, bloomX - lean * 0.2, bloomY + stemLength * 0.25, bloomX, bloomY);

        p5.push();
        p5.translate(bloomX, bloomY);
        p5.rotate(phase);
        p5.stroke(withAlpha(params.bloomColor, dark ? 230 : 205));
        p5.strokeWeight(1.1);
        for (let petal = 0; petal < petals; petal++) {
          const angle = (Math.PI * 2 * petal) / petals;
          const px = Math.cos(angle) * bloomRadius;
          const py = Math.sin(angle) * bloomRadius;
          p5.ellipse(px, py, bloomRadius * 0.9, bloomRadius * 0.32);
        }
        p5.noStroke();
        p5.fill(params.signalColor);
        p5.circle(0, 0, Math.max(5, bloomRadius * 0.28));
        p5.pop();
      }
    }

    p5.noStroke();
    p5.fill(withAlpha(params.signalColor, dark ? 38 : 28));
    p5.textSize(18);
    p5.textAlign(p5.RIGHT, p5.BOTTOM);
    p5.text(`#${tokenId}`, p5.width - 34, p5.height - 30);
  },

  features(ctx) {
    const { params } = ctx;
    return {
      Palette: params.background + " / " + params.bloomColor,
      Garden: params.gardenSize > 9 ? "Dense" : params.gardenSize > 7 ? "Planted" : "Sparse",
      Signals: String(params.waveCount),
      Drift: params.jitter > 0.45 ? "Windy" : params.jitter > 0.24 ? "Breathing" : "Still",
      Mode: params.nightMode ? "Night" : "Day"
    };
  }
};

function withAlpha(hex, alpha) {
  const clamped = Math.max(0, Math.min(255, Math.round(alpha)));
  return `${hex}${clamped.toString(16).padStart(2, "0")}`;
}
