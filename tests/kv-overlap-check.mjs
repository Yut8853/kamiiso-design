const endpoint = process.argv[2];

if (!endpoint) {
  throw new Error('Pass the Chrome DevTools page WebSocket URL.');
}

const socket = new WebSocket(endpoint);
let requestId = 0;
const pending = new Map();

socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  const resolve = pending.get(message.id);
  if (!resolve) return;
  pending.delete(message.id);
  resolve(message);
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

const evaluate = expression =>
  new Promise(resolve => {
    const id = ++requestId;
    pending.set(id, resolve);
    socket.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true },
      })
    );
  });

const response = await evaluate(`(() => {
  const toRect = (element, name) => {
    const rect = element.getBoundingClientRect();
    return {
      name,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      display: getComputedStyle(element).display,
      inlineLeft: element.style.left,
      inlineTop: element.style.top,
      inlineWidth: element.style.width,
      inlineRotate: element.style.rotate,
      inlineTransform: element.style.transform,
      computedRotate: getComputedStyle(element).rotate,
      computedTransform: getComputedStyle(element).transform,
    };
  };
  const overlaps = (a, b) =>
    a.left < b.right && a.right > b.left &&
    a.top < b.bottom && a.bottom > b.top;
  const overlapsWithGap = (a, b, gap) =>
    a.left - gap < b.right && a.right + gap > b.left &&
    a.top - gap < b.bottom && a.bottom + gap > b.top;
  const photos = [...document.querySelectorAll('.kv-photo')]
    .map((element, index) => toRect(element, 'photo-' + (index + 1)))
    .filter(rect => rect.display !== 'none' && rect.width > 0 && rect.height > 0);
  const protectedElements = [
    ['logo', document.querySelector('.site-logo')],
    ['menu', document.querySelector('.menu-button')],
    ['message', document.querySelector('.kv-message')],
  ].filter(([, element]) => element)
    .map(([name, element]) => toRect(element, name));
  const photoPairs = [];
  const photoNearPairs = [];
  const requiredGap = window.innerWidth < 768 ? 8 : 16;
  for (let index = 0; index < photos.length; index++) {
    for (let otherIndex = index + 1; otherIndex < photos.length; otherIndex++) {
      if (overlaps(photos[index], photos[otherIndex])) {
        photoPairs.push([photos[index].name, photos[otherIndex].name]);
      }
      if (overlapsWithGap(photos[index], photos[otherIndex], requiredGap)) {
        photoNearPairs.push([photos[index].name, photos[otherIndex].name]);
      }
    }
  }
  const protectedPairs = photos.flatMap(photo =>
    protectedElements
      .filter(protectedRect => overlaps(photo, protectedRect))
      .map(protectedRect => [photo.name, protectedRect.name])
  );
  return {
    loading: document.documentElement.classList.contains('is-loading'),
    scrollable: document.documentElement.scrollHeight > window.innerHeight,
    photos,
    protectedElements,
    photoPairs,
    photoNearPairs,
    protectedPairs,
  };
})()`);

socket.close();

const result = response.result?.result?.value;
if (!result) {
  throw new Error(JSON.stringify(response));
}

console.log(JSON.stringify(result, null, 2));
if (
  result.photos.length !== 5 ||
  result.photoPairs.length ||
  result.photoNearPairs.length ||
  result.protectedPairs.length
) {
  process.exitCode = 1;
}
