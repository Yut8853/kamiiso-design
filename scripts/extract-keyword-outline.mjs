import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const source = process.argv[2];
const output = process.argv[3];
const mobile = process.argv.includes('--mobile');
const agc = JSON.parse(execFileSync('unzip', ['-p', source, 'resources/graphics/graphicContent.agc'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
const symbolId = mobile
  ? '5c33c1f4-a54b-4d8a-bf27-b2e830c8603f'
  : '458d879e-5e8d-4f3c-8a73-338a805aafda';
const keywordSymbol = agc.resources.meta.ux.symbols.find(
  symbol => symbol.meta?.ux?.symbolId === symbolId
);
if (!keywordSymbol) {
  throw new Error(`Keyword component not found: ${symbolId}`);
}
const items = keywordSymbol.group.children;

const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const matrix = (transform) => transform
  ? ` transform="matrix(${transform.a} ${transform.b} ${transform.c} ${transform.d} ${transform.tx} ${transform.ty})"`
  : '';
const color = (paint) => {
  const value = paint?.color?.value;
  return value ? `rgb(${value.r} ${value.g} ${value.b})` : 'currentColor';
};

function render(node) {
  const transform = matrix(node.transform);
  if (node.type === 'group') {
    return `<g${transform}>${(node.group?.children ?? []).map(render).join('')}</g>`;
  }
  if (node.type !== 'shape') return '';
  const fill = node.style?.fill ? color(node.style.fill) : 'none';
  const stroke = node.style?.stroke ? color(node.style.stroke) : 'none';
  const strokeWidth = node.style?.stroke?.width ?? 0;
  const paint = ` fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"`;
  if (node.shape?.type === 'path') return `<path${transform}${paint} d="${esc(node.shape.path)}"/>`;
  if (node.shape?.type === 'line') {
    const { x1, y1, x2, y2 } = node.shape;
    return `<line${transform}${paint} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" vector-effect="non-scaling-stroke"/>`;
  }
  if (node.shape?.type === 'rect') {
    const { x, y, width, height, r } = node.shape;
    const radius = Array.isArray(r) ? r[0] : (r ?? 0);
    return `<rect${transform}${paint} x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"/>`;
  }
  return '';
}

mkdirSync(new URL('../assets/images/', import.meta.url), { recursive: true });
const viewBox = mobile ? '0 0 325 636' : '0 0 1200 535';
writeFileSync(output, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" overflow="visible" role="img" aria-labelledby="title"><title id="title">キーワードで見るカミイソ</title>${items.map(render).join('')}</svg>\n`);
