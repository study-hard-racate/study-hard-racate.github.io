/* SVG 持久化渲染引擎：
   按 key 复用 DOM 元素，只更新变化的属性，配合 CSS transition 实现平滑动画。
   避免每步重绘 innerHTML 导致的跳动。 */

const SVG_NS = "http://www.w3.org/2000/svg";

function el(k, t, a, c) { return { k: k, t: t, a: a, c: c }; }
function rect(k, x, y, w, h, a) { return el(k, "rect", Object.assign({ x: x, y: y, width: w, height: h, rx: 4 }, a)); }
function circ(k, cx, cy, r, a) { return el(k, "circle", Object.assign({ cx: cx, cy: cy, r: r }, a)); }
function line(k, x1, y1, x2, y2, a) { return el(k, "line", Object.assign({ x1: x1, y1: y1, x2: x2, y2: y2 }, a)); }
function text(k, x, y, c, a) { return el(k, "text", Object.assign({ x: x, y: y }, a), c); }
function path(k, d, a) { return el(k, "path", Object.assign({ d: d }, a)); }

/* 把 specs 数组同步到 svg 上（新增/更新/删除，按 key 比对） */
function syncSvg(svg, specs, viewBox) {
  if (!svg.__specs) {
    svg.setAttribute("viewBox", viewBox);
    svg.__specs = {};
  } else if (svg.getAttribute("viewBox") !== viewBox) {
    svg.setAttribute("viewBox", viewBox);
  }
  const cur = svg.__specs;
  const next = {};
  for (const spec of specs) {
    let node = cur[spec.k];
    if (!node) {
      node = document.createElementNS(SVG_NS, spec.t);
      svg.appendChild(node);
    }
    const attrs = spec.a || {};
    for (const an in attrs) {
      const av = String(attrs[an]);
      if (node.getAttribute(an) !== av) node.setAttribute(an, av);
    }
    if (spec.c !== undefined) {
      const tv = String(spec.c);
      if (node.textContent !== tv) node.textContent = tv;
    }
    next[spec.k] = node;
  }
  for (const k in cur) {
    if (!(k in next)) svg.removeChild(cur[k]);
  }
  svg.__specs = next;
}

/* 在 stage 容器中保证唯一的 svg，并同步渲染 */
function renderSVG(stage, viewBox, specs) {
  let svg = stage.__svg;
  if (!svg) {
    svg = document.createElementNS(SVG_NS, "svg");
    stage.__svg = svg;
    stage.appendChild(svg);
  }
  syncSvg(svg, specs, viewBox);
  return svg;
}
