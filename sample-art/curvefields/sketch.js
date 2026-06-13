window.ArtNamespace = {
  setup(ctx) {
    const { p5 } = ctx;
    p5.createCanvas(1000, 1000);
    p5.noLoop();
  },

  draw(ctx) {
    const { p5, params, rand } = ctx;
    p5.background(params.background);
    p5.stroke(params.foreground);
    p5.strokeWeight(1.4);
    p5.noFill();

    const center = p5.width / 2;
    const count = params.density;
    const turns = params.symmetry;

    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 30 + rand() * 430;
      const wobble = 18 + rand() * 160 * params.curveIntensity;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;

      for (let arm = 0; arm < turns; arm++) {
        const theta = angle + (Math.PI * 2 * arm) / turns;
        const ax = center + Math.cos(theta) * radius;
        const ay = center + Math.sin(theta) * radius;
        p5.bezier(
          ax,
          ay,
          ax + Math.cos(theta + 0.9) * wobble,
          ay + Math.sin(theta + 0.9) * wobble,
          x + Math.cos(theta - 1.4) * wobble,
          y + Math.sin(theta - 1.4) * wobble,
          center + Math.cos(theta) * (radius * 0.2),
          center + Math.sin(theta) * (radius * 0.2)
        );
      }
    }
  },

  features(ctx) {
    const { params } = ctx;
    return {
      Palette: params.background + " / " + params.foreground,
      Curve: params.curveIntensity > 0.7 ? "Wild" : params.curveIntensity > 0.4 ? "Lyrical" : "Calm",
      Density: params.density > 210 ? "Dense" : params.density > 130 ? "Balanced" : "Sparse",
      Symmetry: String(params.symmetry),
      Motion: params.loop ? "Loop" : "Still"
    };
  }
};
