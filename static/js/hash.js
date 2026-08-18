/* 哈希表渲染器（链地址法）：竖直表槽（0..N-1）+ 每个槽的横向冲突链。
   输入为 csim 图模式快照：{ adj:{槽号→[节点id]}, data:{节点id→值}, n, vars, cur }。 */

function renderHash(stage, snap) {
  const n = (snap && snap.n) ? snap.n : 0;
  if (!n) {
    renderSVG(stage, "0 0 300 120",
      [text("hempty", 150, 60, "（空哈希表）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }
  const SLOT_H = 34;
  const SLOT_GAP = 8;
  const H_LEFT = 30;
  const H_TOP = 40;
  const CHAIN_H = 30;
  const CHAIN_W = 52;
  const H = H_TOP + n * (SLOT_H + SLOT_GAP) + 20;
  const W = 720;
  const specs = [];

  specs.push(text("htitle", H_LEFT, 20, "哈希表（链地址法）：h(v) = v % " + n,
    { "font-size": 13, fill: "#8fa1bd" }));

  let maxChain = 0;
  for (let i = 0; i < n; i++) maxChain = Math.max(maxChain, ((snap.adj && snap.adj[i]) || []).length);

  for (let i = 0; i < n; i++) {
    const y = H_TOP + i * (SLOT_H + SLOT_GAP);
    const chain = (snap.adj && snap.adj[i]) || [];
    /* 槽 */
    specs.push(rect("hs-" + i, H_LEFT, y, 46, SLOT_H, {
      rx: 6, fill: "#1f2940", stroke: "#5eead4", "stroke-width": 1.5,
    }));
    specs.push(text("hsn-" + i, H_LEFT + 23, y + SLOT_H / 2 + 5, String(i),
      { "text-anchor": "middle", "font-size": 13, "font-weight": "bold", fill: "#5eead4" }));
    /* 冲突链 */
    for (let k = 0; k < chain.length; k++) {
      const id = chain[k];
      const x = H_LEFT + 52 + k * (CHAIN_W + 14);
      const isCur = snap.cur !== null && snap.cur !== undefined && id === snap.cur;
      const val = snap.data[id];
      specs.push(rect("hn-" + id, x, y + 2, CHAIN_W, CHAIN_H, {
        rx: 6,
        fill: isCur ? "rgba(255,209,102,.25)" : "#232c40",
        stroke: isCur ? "#ffd166" : "#4da3ff",
        "stroke-width": isCur ? 2.5 : 1.5,
      }));
      specs.push(text("hnt-" + id, x + CHAIN_W / 2, y + 2 + CHAIN_H / 2 + 5,
        val === undefined ? "·" : String(val),
        { "text-anchor": "middle", "font-size": 14, "font-weight": "bold", fill: isCur ? "#ffd166" : "#e8eef7" }));
      if (k < chain.length - 1) {
        specs.push(line("he-" + id, x + CHAIN_W, y + 2 + CHAIN_H / 2, x + CHAIN_W + 14, y + 2 + CHAIN_H / 2,
          { stroke: "#4da3ff", "stroke-width": 2 }));
        specs.push(path("hea-" + id, "M" + (x + CHAIN_W + 8) + "," + (y + 2 + CHAIN_H / 2 - 4) +
          " L" + (x + CHAIN_W + 14) + "," + (y + 2 + CHAIN_H / 2) +
          " L" + (x + CHAIN_W + 8) + "," + (y + 2 + CHAIN_H / 2 + 4) + " Z",
          { fill: "#4da3ff" }));
      }
    }
  }
  renderSVG(stage, "0 0 " + W + " " + H, specs);
}
