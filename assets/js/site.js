import * as THREE from './three.module.min.js';

const reducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;
const constrainedDevice =
  navigator.connection?.saveData === true ||
  (Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4) ||
  (Number.isFinite(navigator.hardwareConcurrency) &&
    navigator.hardwareConcurrency <= 4);

const kvPhotoImages = [
  '0003',
  '0005',
  '0006',
  '0007',
  '0012',
  '0013',
  '0014',
  '0017',
  '0020',
  '0022',
  '0025',
  '0026',
  '0037',
  '0038',
  '0039',
  '0040',
  '0045',
  '0053',
  '0056',
  '0057',
  '0058',
  '0059',
  '0060',
  '0062',
  '0063',
  '0064',
  '0067',
  '0074',
  '0076',
  '0087',
  '0096',
  '0099',
  '0114',
  '0116',
  '0121',
  '0125',
].map(name => `assets/images/kv-random/photos/${name}`);

const excludedKvDotImageNumbers = new Set([
  19, 20, 21, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62,
]);

const kvDotImages = Array.from({ length: 75 }, (_, index) => index + 1)
  .filter(number => excludedKvDotImageNumbers.has(number) === false)
  .map(
    number =>
      `assets/images/kv-random/dots/dot-${String(number).padStart(3, '0')}`
  );

const largeKvDotImageNumbers = new Set([
  ...Array.from({ length: 13 }, (_, index) => index + 6),
  ...Array.from({ length: 8 }, (_, index) => index + 68),
]);

const fallbackVertexShader = `
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aScale;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uSizeMultiplier;
  varying vec3 vColor;

  void main() {
    vec3 animated = position;
    animated.x += cos(uTime * aSpeed + aPhase) * aScale;
    animated.y += sin(uTime * aSpeed * 1.35 + aPhase) * aScale * 1.5;
    animated.z += sin(uTime * aSpeed * 0.8 + aPhase) * 0.22;

    float cx = cos(uPointer.y);
    float sx = sin(uPointer.y);
    float cy = cos(uPointer.x);
    float sy = sin(uPointer.x);
    animated = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy) * animated;
    animated = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx) * animated;

    vec4 mvPosition = modelViewMatrix * vec4(animated, 1.0);
    gl_PointSize = 40.0 * uSizeMultiplier * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    vColor = color;
  }
`;

const fallbackFragmentShader = `
  precision highp float;
  varying vec3 vColor;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceFromCenter = length(point);
    if (distanceFromCenter > 0.5) discard;
    float core = 1.0 - smoothstep(0.08, 0.24, distanceFromCenter);
    float halo = 1.0 - smoothstep(0.18, 0.5, distanceFromCenter);
    vec3 glowColor = mix(vColor, vec3(1.0), 0.24 + core * 0.22);
    float alpha = core * 0.46 + halo * 0.28;
    gl_FragColor = vec4(glowColor, alpha);
  }
`;

const maxKvPhotoWidthPx = 640;
const kvDecorVisibleDuration = 5000;
const kvDecorFadeDuration = 1400;
const loaderMinimumDuration = 500;
const loaderTaskTimeout = 500;
const loaderCompletionDuration = 100;
const loaderScatterDuration = 250;
const loaderFadeDuration = 150;

// The first KV set is decided once. The exact same 12 DOM elements/images are
// used in the loader, then returned to the KV and animated to their final spots.
const initialKvPhotoImages = selectInitialKvPhotoImages(kvPhotoImages, 5);
const initialKvDotImages = shuffleItems(kvDotImages).slice(0, 7);

function selectInitialKvPhotoImages(images, count) {
  const storageKey = 'kv-random-photo-selection';
  let previousImages = [];

  try {
    previousImages = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
  } catch {
    previousImages = [];
  }

  // When enough candidates exist, avoid the previous load's photos
  // entirely. This makes the random selection visually apparent on reload.
  const previousImageSet = new Set(previousImages);
  const freshCandidates = images.filter(image => !previousImageSet.has(image));
  const candidates = freshCandidates.length >= count ? freshCandidates : images;
  const selectedImages = shuffleItems(candidates).slice(0, count);

  try {
    sessionStorage.setItem(storageKey, JSON.stringify(selectedImages));
  } catch {
    // Random selection still works when storage is unavailable.
  }

  return selectedImages;
}

function prepareKvLoaderSequence() {
  const loader = document.querySelector('.site-loader');
  const decor = document.querySelector('.kv-decor');
  if (!loader || !decor) return null;

  const photoBlocks = [...document.querySelectorAll('.kv-photo-block')].slice(0, 5);
  const dots = [...document.querySelectorAll('.kv-dot')].slice(0, 7);

  // Paint every first-view asset immediately so the loader never starts blank.
  photoBlocks.forEach((block, index) => {
    setResponsiveBackground(block, initialKvPhotoImages[index]);
  });
  dots.forEach((dot, index) => {
    setResponsiveBackground(dot, initialKvDotImages[index]);
  });

  // These are the actual KV DOM nodes. During loading CSS temporarily gathers
  // them in the exact center; their final KV inline styles are calculated in
  // the background and become the scatter destinations at 100%.
  const items = shuffleItems([
    ...photoBlocks.map(block => block.closest('.kv-photo')).filter(Boolean),
    ...dots,
  ].filter(element => getComputedStyle(element).display !== 'none'));
  if (!items.length) return null;
  // Show half of the KV pieces in the loading stack. All pieces still settle
  // into the hero so the finished composition remains unchanged.
  const loaderItems = items.filter((_, index) => index % 2 === 0);

  items.forEach((element, index) => {
    element.classList.add('is-loading-card');
    element.classList.remove('is-loader-active');
    element.style.setProperty('--loader-stack-x', `${(index % 4 - 1.5) * 2.5}px`);
    element.style.setProperty('--loader-stack-y', `${(index % 3 - 1) * 2}px`);
    element.style.setProperty('--loader-stack-rotate', `${(index % 7 - 3) * 0.9}deg`);
    element.style.setProperty('--loader-stack-z', String(items.length - index));
  });

  const imagePaths = [...initialKvPhotoImages, ...initialKvDotImages];
  // CSS selects AVIF first, so the loader must wait for that same resource.
  // Waiting only for WebP made the progress reach 100% while the visible AVIF
  // files were still downloading.
  const preloadTasks = imagePaths.map(preloadKvImage);

  let activeIndex = 0;
  let timer = null;
  const start = () => {
    if (reducedMotion || timer || loaderItems.length < 2) return;
    loaderItems[activeIndex].classList.add('is-loader-active');
    timer = window.setInterval(() => {
      loaderItems[activeIndex].classList.remove('is-loader-active');
      activeIndex = (activeIndex + 1) % loaderItems.length;
      loaderItems[activeIndex].classList.add('is-loader-active');
    }, 120);
  };
  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  };

  start();

  return { loader, decor, items, loaderItems, preloadTasks, stop };
}

async function initializeLoadingScreen(extraTasks = [], sequence = null) {
  const loader = document.querySelector('.site-loader');
  if (!loader) return Promise.resolve();

  // Match the attributes already present in index.html. Keep the fallback
  // selectors only for compatibility with earlier drafts.
  const value = document.querySelector('[data-loader-value], [data-loading-value]');
  const bar = document.querySelector('[data-loader-progress], [data-loading-bar]');
  const tasks = createLoadingTasks([
    ...extraTasks,
    ...(sequence?.preloadTasks || []),
  ]);
  const tasksReady = Promise.allSettled(tasks);
  const startedAt = performance.now();
  const minimumDuration = reducedMotion ? 250 : loaderMinimumDuration;
  let tasksFinished = false;
  let displayedProgress = 0;
  let completionStartedAt = 0;

  Promise.race([tasksReady, wait(loaderTaskTimeout)]).then(() => {
    tasksFinished = true;
    sequence?.start();
  });

  const renderProgress = progress => {
    const rounded = Math.min(100, Math.max(0, Math.round(progress)));
    if (value) value.textContent = String(rounded);
    if (bar) {
      bar.style.transform = `scaleX(${rounded / 100})`;
      bar.style.setProperty('--loading-progress', String(rounded / 100));
    }
  };

  renderProgress(0);

  await new Promise(resolve => {
    const animate = now => {
      const elapsed = now - startedAt;
      // Keep moving visibly even while the final KV geometry/images are being
      // prepared, but reserve the last 8% until all required work is ready.
      const timedProgress = Math.min(92, (elapsed / minimumDuration) * 92);
      displayedProgress = Math.max(displayedProgress, timedProgress);

      if (tasksFinished && elapsed >= minimumDuration) {
        if (!completionStartedAt) completionStartedAt = now;
        const finishRatio = Math.min(
          1,
          (now - completionStartedAt) / loaderCompletionDuration
        );
        displayedProgress = 92 + finishRatio * 8;
      }

      renderProgress(displayedProgress);
      if (displayedProgress >= 100) {
        renderProgress(100);
        resolve();
        return;
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  });

  sequence?.stop();
  try {
    if (sequence && !reducedMotion) {
      await scatterKvLoaderSequence(sequence);
    } else if (sequence) {
      restoreKvLoaderItems(sequence);
    }
  } finally {
    // Never leave the fixed loading layer or scroll lock behind if a reveal
    // animation is interrupted or unsupported by the browser.
    await revealLoadedSite(loader);
  }
}

function restoreKvLoaderItems(sequence) {
  sequence.items.forEach(element => {
    element.classList.remove('is-loading-card', 'is-loader-active');
    element.style.removeProperty('--loader-stack-x');
    element.style.removeProperty('--loader-stack-y');
    element.style.removeProperty('--loader-stack-rotate');
    element.style.removeProperty('--loader-stack-z');
  });
}

async function scatterKvLoaderSequence(sequence) {
  const { loader, items, loaderItems } = sequence;
  loader.classList.add('is-revealing');

  // Reveal the complete stack and fan every item out immediately.
  loaderItems.forEach(element => element.classList.add('is-loader-active'));

  const firstRects = loaderItems.map(element => element.getBoundingClientRect());

  // Switch the decor container back to the hero coordinate system and expose
  // each element's already-calculated final KV position.
  document.body.classList.add('is-loader-scattering');
  items.forEach(element => element.classList.remove('is-loading-card'));

  // Force final layout before building the inverse FLIP transforms.
  const lastRects = loaderItems.map(element => element.getBoundingClientRect());

  const progress = document.querySelector('.site-loader__progress');
  progress?.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration: 100, easing: 'ease-out', fill: 'forwards' }
  );

  window.setTimeout(() => {
    document.body.classList.add('is-loader-copy-visible');
  }, 120);

  const animations = loaderItems.map((element, index) => {
    const first = firstRects[index];
    const last = lastRects[index];
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const settledTransform = getComputedStyle(element).transform;
    const finalTransform =
      settledTransform === 'none' ? '' : settledTransform;

    return element.animate(
      [
        {
          transformOrigin: '0 0',
          transform: `translate(${dx}px, ${dy}px) ${finalTransform}`.trim(),
          opacity: 1,
        },
        {
          transformOrigin: '0 0',
          transform: finalTransform || 'translate(0, 0)',
          opacity: 1,
        },
      ],
      {
        duration: loaderScatterDuration,
        delay: 0,
        easing: 'cubic-bezier(0.2, 0.78, 0.2, 1)',
        fill: 'both',
      }
    );
  });

  await Promise.all(
    animations.map(animation => animation.finished.catch(() => undefined))
  );
  // Preserve the exact scattered end state. Cancelling without committing can
  // briefly restore the pre-animation transform and make cards jump or resize.
  animations.forEach(animation => {
    animation.commitStyles?.();
    animation.cancel();
  });

  restoreKvLoaderItems(sequence);
  unlockPageScroll();
}

async function revealLoadedSite(loader) {
  document.body.classList.add('is-loader-copy-visible');
  unlockPageScroll();
  document.body.classList.remove('is-loader-scattering');
  document.body.classList.add('is-loaded');

  try {
    const fade = loader.animate?.(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: loaderFadeDuration, easing: 'ease-out', fill: 'forwards' }
    );
    await fade?.finished?.catch(() => undefined);
  } finally {
    loader.hidden = true;
    loader.setAttribute('aria-hidden', 'true');
  }
  const progress = document.querySelector('.site-loader__progress');
  if (progress) progress.hidden = true;
}

function unlockPageScroll() {
  document.documentElement.classList.remove('is-loading');
  document.body.classList.remove('is-loading');
  document.documentElement.style.removeProperty('height');
  document.documentElement.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('overscroll-behavior');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('inset');
  document.body.style.removeProperty('width');
  document.body.style.removeProperty('height');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('overscroll-behavior');
}

function startKvImageRotation(items) {
  if (reducedMotion || constrainedDevice || !items.length) return;

  const photos = items.filter(item => item.matches('.kv-photo'));
  const dots = [...document.querySelectorAll('.kv-dot')];
  if (!photos.length && !dots.length) return;

  const changeNext = async () => {
    window.setTimeout(changeNext, 4000);
    const photoTargets = photos
      .map(photo => photo.querySelector('.kv-photo-block'))
      .filter(Boolean);
    const createAssignments = (targets, pool) => {
      const currentPaths = new Set(
        targets.map(target => target.dataset.kvImagePath).filter(Boolean)
      );
      const freshPool = pool.filter(path => !currentPaths.has(path));
      const candidates = freshPool.length >= targets.length ? freshPool : pool;
      const nextPaths = shuffleItems(candidates).slice(0, targets.length);
      return targets.map((target, index) => ({
        target,
        path: nextPaths[index],
      }));
    };
    const assignments = [
      ...createAssignments(photoTargets, kvPhotoImages),
      ...createAssignments(dots, kvDotImages),
    ].filter(assignment => assignment.path);
    if (!assignments.length) return;

    await Promise.all(assignments.map(({ path }) => preloadKvImage(path)));
    const swaps = assignments.map(({ target }) =>
      target.animate(
        [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }],
        { duration: 900, easing: 'ease-in-out' }
      )
    );
    window.setTimeout(() => {
      assignments.forEach(({ target, path }) => {
        setResponsiveBackground(target, path);
      });
    }, 450);
    swaps.forEach(swap => swap.finished.catch(() => undefined));
  };

  window.setTimeout(changeNext, 4000);
}

function shouldShowLoadingScreen() {
  const storageKey = 'kv-loading-screen-shown';
  try {
    if (sessionStorage.getItem(storageKey) === 'true') return false;
    sessionStorage.setItem(storageKey, 'true');
  } catch {
    // Show the loader when session storage is unavailable.
  }
  return true;
}

function skipLoadingScreen() {
  const loader = document.querySelector('.site-loader');
  if (loader) {
    loader.hidden = true;
    loader.setAttribute('aria-hidden', 'true');
  }
  const progress = document.querySelector('.site-loader__progress');
  if (progress) progress.hidden = true;
  document.body.classList.add('is-loader-copy-visible', 'is-loaded');
  unlockPageScroll();
}

function createLoadingTasks(extraTasks) {
  const urls = collectLoadingImageUrls();
  const tasks = [...urls].map(preloadImage);
  tasks.push(...extraTasks);
  tasks.push(waitForWindowLoad());
  if (document.fonts?.ready) tasks.push(document.fonts.ready.catch(() => {}));
  return tasks;
}

function collectLoadingImageUrls() {
  const urls = new Set();
  document.querySelectorAll('link[rel="preload"][as="image"]').forEach(link => {
    addLoadingUrl(urls, link.getAttribute('href'));
  });
  document.querySelectorAll('img:not([loading="lazy"])').forEach(image => {
    addLoadingUrl(urls, image.currentSrc);
    addLoadingUrl(urls, image.getAttribute('src'));
    addSrcsetUrls(urls, image.getAttribute('srcset'));
  });
  document.querySelectorAll('source[srcset]').forEach(source => {
    if (source.closest('picture')?.querySelector('img[loading="lazy"]')) return;
    addSrcsetUrls(urls, source.getAttribute('srcset'));
  });
  return urls;
}

function addSrcsetUrls(urls, srcset) {
  if (!srcset) return;
  srcset.split(',').forEach(candidate => {
    addLoadingUrl(urls, candidate.trim().split(/\s+/)[0]);
  });
}

function addCssImageUrls(urls, imageValue) {
  if (!imageValue || imageValue === 'none') return;
  [...imageValue.matchAll(/url\(["']?([^"')]+)["']?\)/g)].forEach(match => {
    addLoadingUrl(urls, match[1]);
  });
}

function addLoadingUrl(urls, url) {
  if (!url || url.startsWith('data:')) return;
  try {
    urls.add(new URL(url, document.baseURI).href);
  } catch {
    urls.add(url);
  }
}

function preloadImage(url) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      image.decode?.().catch(() => {}).finally(resolve) ?? resolve();
    };
    image.onerror = resolve;
    image.src = url;
  });
}

function preloadKvImage(path) {
  return new Promise(resolve => {
    const image = new Image();
    const finish = () => resolve();
    image.onload = () => {
      // decode() ensures the file is ready to paint, not merely downloaded.
      image.decode?.().catch(() => {}).finally(finish) ?? finish();
    };
    image.onerror = () => {
      const fallback = new Image();
      fallback.onload = finish;
      fallback.onerror = finish;
      fallback.src = `${path}.webp`;
    };
    image.src = `${path}.avif`;
  });
}

function waitForWindowLoad() {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    window.addEventListener('load', resolve, { once: true });
  });
}

async function initializeKvRandomDecor() {
  // CSS owns the fixed destinations, including responsive sizing. Image swaps
  // and the loader animate these same nodes without changing their placement.
  document.querySelectorAll('.kv-photo-block').forEach((block, index) => {
    setResponsiveBackground(block, initialKvPhotoImages[index]);
  });
  document.querySelectorAll('.kv-dot').forEach((block, index) => {
    setResponsiveBackground(block, initialKvDotImages[index]);
  });
  document.querySelector('.kv-decor')?.classList.add('is-settled');
}

async function placeKvPhotosAcrossHero(
  photoBlocks,
  imagePaths,
  zones,
  hero,
  heroWidth,
  heroHeight,
  isNarrowHero
) {
  const protectedRects = getKvProtectedElementRects(hero, heroWidth, heroHeight);
  const occupiedRects = [...protectedRects];
  const photoGap = isNarrowHero ? 2.5 : 3;

  for (let index = 0; index < photoBlocks.length; index++) {
    const block = photoBlocks[index];
    const photo = block.closest('.kv-photo');
    const path = imagePaths[index];
    const zone = zones[index % zones.length];
    if (!photo || !path || !zone) continue;

    setResponsiveBackground(block, path);
    const naturalAspectRatio = await loadKvImageAspectRatio(path);
    // A consistent landscape frame is required on desktop to keep all six
    // photos within the 24-30% width range. Portrait source
    // images are cropped by the existing background-size: cover treatment.
    const aspectRatio = isNarrowHero ? naturalAspectRatio : 3 / 2;
    const rotation = isNarrowHero
      ? randomSignedBetween(8, 24)
      : randomSignedBetween(6, 12);
    let placement = null;
    const wasLoadingCard = photo.classList.contains('is-loading-card');
    const wasLoaderActive = photo.classList.contains('is-loader-active');

    // Temporarily expose the destination styles while measuring. All candidate
    // checks run synchronously, so the intermediate states are never painted.
    photo.classList.remove('is-loading-card', 'is-loader-active');
    photo.style.display = '';
    photo.style.right = 'auto';
    photo.style.bottom = 'auto';
    photo.style.height = 'auto';
    photo.style.maxWidth = `${maxKvPhotoWidthPx}px`;
    photo.style.aspectRatio = `${aspectRatio}`;
    photo.style.rotate = `${rotation}deg`;

    for (const scale of [1, 0.92, 0.84, 0.76, 0.68, 0.6]) {
      for (let attempt = 0; attempt < 160; attempt++) {
        const baseWidth = isNarrowHero
          ? randomBetween(19, 25)
          : randomBetween(24, 30);
        const width = isNarrowHero
          ? baseWidth * scale
          : Math.max(24, baseWidth * scale);
        const height = ((width / 100) * heroWidth / aspectRatio / heroHeight) * 100;
        const centerX = randomBetween(...zone.x);
        const centerY = randomBetween(...zone.y);
        applyKvPhotoCandidate(
          photo,
          centerX,
          centerY,
          width,
          height
        );
        const bounds = measureKvElementBounds(photo, hero);

        const insideHero =
          bounds.left >= -2 &&
          bounds.top >= 10 &&
          bounds.left + bounds.width <= 102 &&
          bounds.top + bounds.height <= 98;
        const collisionFree = occupiedRects.every(
          occupied => !rectsOverlap(bounds, occupied, photoGap)
        );
        if (!insideHero || !collisionFree) continue;

        placement = { centerX, centerY, width, height, bounds };
        break;
      }
      if (placement) break;
    }

    // Exhaustively search the assigned perimeter zone at compact sizes. Every
    // fallback candidate still passes the same rotated-bounds collision test.
    if (!placement) {
      const compactWidths = isNarrowHero
        ? [16, 14, 12, 10, 8, 7]
        : [24, 22, 20];
      for (const width of compactWidths) {
        const height =
          ((width / 100) * heroWidth / aspectRatio / heroHeight) * 100;
        for (let xStep = 0; xStep <= 8 && !placement; xStep++) {
          for (let yStep = 0; yStep <= 8; yStep++) {
            const centerX = zone.x[0] +
              ((zone.x[1] - zone.x[0]) * xStep) / 8;
            const centerY = zone.y[0] +
              ((zone.y[1] - zone.y[0]) * yStep) / 8;
            applyKvPhotoCandidate(
              photo,
              centerX,
              centerY,
              width,
              height
            );
            const bounds = measureKvElementBounds(photo, hero);
            const insideHero =
              bounds.left >= -2 &&
              bounds.top >= 10 &&
              bounds.left + bounds.width <= 102 &&
              bounds.top + bounds.height <= 98;
            const collisionFree = occupiedRects.every(
              occupied => !rectsOverlap(bounds, occupied, photoGap)
            );
            if (!insideHero || !collisionFree) continue;
            placement = { centerX, centerY, width, height, bounds };
            break;
          }
        }
        if (placement) break;
      }
    }

    // Keep all six photos visible even on unusually constrained viewport
    // ratios. Each emergency position remains inside its dedicated zone.
    if (!placement) {
      const width = isNarrowHero ? 8 : 12;
      const height = ((width / 100) * heroWidth / aspectRatio / heroHeight) * 100;
      placement = {
        centerX: (zone.x[0] + zone.x[1]) / 2,
        centerY: (zone.y[0] + zone.y[1]) / 2,
        width,
        height,
        bounds: getRotatedKvBounds(
          (zone.x[0] + zone.x[1]) / 2,
          (zone.y[0] + zone.y[1]) / 2,
          width,
          height,
          rotation,
          heroWidth,
          heroHeight
        ),
      };
    }

    applyKvPhotoCandidate(
      photo,
      placement.centerX,
      placement.centerY,
      placement.width,
      placement.height
    );
    occupiedRects.push({ ...placement.bounds, type: 'photo' });
    if (wasLoadingCard) photo.classList.add('is-loading-card');
    if (wasLoaderActive) photo.classList.add('is-loader-active');
  }

  enforceKvPhotoSeparation(photoBlocks, hero, zones);
}

function applyKvPhotoCandidate(photo, centerX, centerY, width, height) {
  photo.style.width = `${width}%`;
  photo.style.left = `${centerX - width / 2}%`;
  photo.style.top = `${centerY - height / 2}%`;
}

function measureKvElementBounds(element, hero) {
  const rect = element.getBoundingClientRect();
  const heroRect = hero.getBoundingClientRect();
  return {
    left: ((rect.left - heroRect.left) / heroRect.width) * 100,
    top: ((rect.top - heroRect.top) / heroRect.height) * 100,
    width: (rect.width / heroRect.width) * 100,
    height: (rect.height / heroRect.height) * 100,
  };
}

function enforceKvPhotoSeparation(photoBlocks, hero, zones) {
  if (!hero) return;
  const wasScattering = document.body.classList.contains('is-loader-scattering');
  document.body.classList.add('is-loader-scattering');
  const photos = photoBlocks
    .map(block => block.closest('.kv-photo'))
    .filter(Boolean);
  const loaderStates = photos.map(photo => ({
    photo,
    loading: photo.classList.contains('is-loading-card'),
    active: photo.classList.contains('is-loader-active'),
  }));

  // Measure the real settled layout, not the temporary centered loader stack.
  loaderStates.forEach(({ photo }) =>
    photo.classList.remove('is-loading-card', 'is-loader-active')
  );

  const heroRect = hero.getBoundingClientRect();
  const isNarrowHero = heroRect.width < 768;
  const visualGapPx = isNarrowHero ? 10 : 32;
  const copyGapPx = 50;
  const protectedRects = ['.site-logo', '.menu-button', '.kv-message']
    .map(selector => document.querySelector(selector))
    .filter(Boolean)
    .map(element => {
      const rect = element.getBoundingClientRect();
      const padding = element.matches('.kv-message')
        ? 0
        : isNarrowHero ? 6 : 16;
      return {
        type: element.matches('.kv-message') ? 'message' : 'header',
        left: rect.left - padding,
        top: rect.top - padding,
        right: rect.right + padding,
        bottom: rect.bottom + padding,
      };
    });
  const occupiedRects = [...protectedRects];

  photos.forEach((photo, index) => {
    const zone = zones[index % zones.length];
    if (photo.style.display === 'none') {
      const recoveryWidth = isNarrowHero ? 8 : 20;
      const recoveryAspectRatio = parseFloat(photo.style.aspectRatio) || 3 / 2;
      const recoveryHeightPx =
        (recoveryWidth / 100) * heroRect.width / recoveryAspectRatio;
      const recoveryHeight = (recoveryHeightPx / heroRect.height) * 100;
      const recoveryCenterX = zone ? (zone.x[0] + zone.x[1]) / 2 : 50;
      const recoveryCenterY = zone ? (zone.y[0] + zone.y[1]) / 2 : 50;
      photo.style.display = '';
      applyKvPhotoCandidate(
        photo,
        recoveryCenterX,
        recoveryCenterY,
        recoveryWidth,
        recoveryHeight
      );
    }
    const originalWidth = parseFloat(photo.style.width) || 12;
    const originalLeft = parseFloat(photo.style.left) || 0;
    const aspectRatio = parseFloat(photo.style.aspectRatio) || 3 / 2;
    const rawHeightPx = (originalWidth / 100) * heroRect.width / aspectRatio;
    const originalHeight = (rawHeightPx / heroRect.height) * 100;
    const originalTop = parseFloat(photo.style.top) || 0;
    const centerX = originalLeft + originalWidth / 2;
    const centerY = originalTop + originalHeight / 2;
    let acceptedRect = null;

    for (const scale of [1, 0.9, 0.8, 0.7, 0.6, 0.5]) {
      const width = isNarrowHero
        ? originalWidth * scale
        : Math.max(20, originalWidth * scale);
      const heightPx = (width / 100) * heroRect.width / aspectRatio;
      const height = (heightPx / heroRect.height) * 100;
      const centers = [{ x: centerX, y: centerY }];
      if (zone) {
        for (let xStep = 0; xStep <= 6; xStep++) {
          for (let yStep = 0; yStep <= 6; yStep++) {
            centers.push({
              x: zone.x[0] + ((zone.x[1] - zone.x[0]) * xStep) / 6,
              y: zone.y[0] + ((zone.y[1] - zone.y[0]) * yStep) / 6,
            });
          }
        }
      }

      for (const candidateCenter of centers) {
        applyKvPhotoCandidate(
          photo,
          candidateCenter.x,
          candidateCenter.y,
          width,
          height
        );
        const rect = photo.getBoundingClientRect();
        const insideHero =
          rect.left >= heroRect.left - 24 &&
          rect.top >= heroRect.top + (isNarrowHero ? 64 : 80) &&
          rect.right <= heroRect.right + 24 &&
          rect.bottom <= heroRect.bottom - 12;
        const separated = occupiedRects.every(occupied =>
          !pixelRectsOverlap(
            rect,
            occupied,
            occupied.type === 'message' ? copyGapPx : visualGapPx
          )
        );
        if (!insideHero || !separated) continue;
        acceptedRect = rect;
        break;
      }
      if (acceptedRect) break;
    }

    if (!acceptedRect) {
      const fallbackWidth = isNarrowHero ? 8 : 12;
      const fallbackHeightPx =
        (fallbackWidth / 100) * heroRect.width / aspectRatio;
      const fallbackHeight = (fallbackHeightPx / heroRect.height) * 100;
      const fallbackCenterX = zone ? (zone.x[0] + zone.x[1]) / 2 : centerX;
      const fallbackCenterY = zone ? (zone.y[0] + zone.y[1]) / 2 : centerY;
      photo.style.display = '';
      applyKvPhotoCandidate(
        photo,
        fallbackCenterX,
        fallbackCenterY,
        fallbackWidth,
        fallbackHeight
      );
      acceptedRect = photo.getBoundingClientRect();
      const messageRect = protectedRects.find(rect => rect.type === 'message');
      const zoneCenterY = zone ? (zone.y[0] + zone.y[1]) / 2 : 50;
      if (messageRect && zoneCenterY < 25) {
        const overlapPx = acceptedRect.bottom + copyGapPx - messageRect.top;
        if (overlapPx > 0) {
          const correctedCenterY =
            fallbackCenterY - (overlapPx / heroRect.height) * 100;
          applyKvPhotoCandidate(
            photo,
            fallbackCenterX,
            correctedCenterY,
            fallbackWidth,
            fallbackHeight
          );
          acceptedRect = photo.getBoundingClientRect();
        }
      } else if (messageRect && zoneCenterY > 75) {
        const overlapPx = messageRect.bottom + copyGapPx - acceptedRect.top;
        if (overlapPx > 0) {
          const correctedCenterY =
            fallbackCenterY + (overlapPx / heroRect.height) * 100;
          applyKvPhotoCandidate(
            photo,
            fallbackCenterX,
            correctedCenterY,
            fallbackWidth,
            fallbackHeight
          );
          acceptedRect = photo.getBoundingClientRect();
        }
      }
    }
    occupiedRects.push(acceptedRect);
  });

  loaderStates.forEach(({ photo, loading, active }) => {
    if (loading) photo.classList.add('is-loading-card');
    if (active) photo.classList.add('is-loader-active');
  });
  if (!wasScattering) document.body.classList.remove('is-loader-scattering');
}

function pixelRectsOverlap(rect, otherRect, gap) {
  return !(
    rect.right + gap <= otherRect.left ||
    otherRect.right + gap <= rect.left ||
    rect.bottom + gap <= otherRect.top ||
    otherRect.bottom + gap <= rect.top
  );
}

function loadKvImageAspectRatio(path) {
  const image = new Image();
  return new Promise(resolve => {
    image.onload = () =>
      resolve(
        image.naturalWidth && image.naturalHeight
          ? image.naturalWidth / image.naturalHeight
          : 3 / 2
      );
    image.onerror = () => {
      const fallback = new Image();
      fallback.onload = () =>
        resolve(
          fallback.naturalWidth && fallback.naturalHeight
            ? fallback.naturalWidth / fallback.naturalHeight
            : 3 / 2
        );
      fallback.onerror = () => resolve(3 / 2);
      fallback.src = `${path}.webp`;
    };
    image.src = `${path}.avif`;
  });
}

function getRotatedKvBounds(
  centerX,
  centerY,
  width,
  height,
  rotation,
  heroWidth,
  heroHeight
) {
  const angle = (Math.abs(rotation) * Math.PI) / 180;
  const widthPx = (width / 100) * heroWidth;
  const heightPx = (height / 100) * heroHeight;
  const rotatedWidth =
    (Math.abs(widthPx * Math.cos(angle)) +
      Math.abs(heightPx * Math.sin(angle))) /
    heroWidth *
    100;
  const rotatedHeight =
    (Math.abs(widthPx * Math.sin(angle)) +
      Math.abs(heightPx * Math.cos(angle))) /
    heroHeight *
    100;

  return {
    left: centerX - rotatedWidth / 2,
    top: centerY - rotatedHeight / 2,
    width: rotatedWidth,
    height: rotatedHeight,
  };
}

function getKvProtectedElementRects(hero, heroWidth, heroHeight) {
  if (!hero) return [];
  const heroRect = hero.getBoundingClientRect();
  return ['.site-logo', '.menu-button', '.kv-message']
    .map(selector => document.querySelector(selector))
    .filter(Boolean)
    .map(element => {
      const rect = element.getBoundingClientRect();
      const gapX = selectorIsHeaderElement(element) ? 3 : 2.5;
      const gapY = selectorIsHeaderElement(element) ? 2.5 : 5;
      return {
        type: 'protected',
        left: ((rect.left - heroRect.left) / heroWidth) * 100 - gapX,
        top: ((rect.top - heroRect.top) / heroHeight) * 100 - gapY,
        width: (rect.width / heroWidth) * 100 + gapX * 2,
        height: (rect.height / heroHeight) * 100 + gapY * 2,
      };
    });
}

function selectorIsHeaderElement(element) {
  return element.matches('.site-logo, .menu-button');
}


function getKvPhotoOccupiedRectsFromStyles(photoBlocks, heroWidth, heroHeight) {
  return photoBlocks
    .map(block => block.closest('.kv-photo'))
    .filter(Boolean)
    .map(photo => {
      const left = parseFloat(photo.style.left) || 0;
      const top = parseFloat(photo.style.top) || 0;
      const width = parseFloat(photo.style.width) || 0;
      const aspectRatio = parseFloat(photo.style.aspectRatio) || 3 / 2;
      const rotation = (Math.abs(parseFloat(photo.style.rotate)) || 0) * Math.PI / 180;
      const widthPx = (width / 100) * heroWidth;
      const heightPx = widthPx / aspectRatio;
      const rotatedWidthPx = Math.abs(widthPx * Math.cos(rotation)) + Math.abs(heightPx * Math.sin(rotation));
      const rotatedHeightPx = Math.abs(widthPx * Math.sin(rotation)) + Math.abs(heightPx * Math.cos(rotation));
      const centerXPx = ((left + width / 2) / 100) * heroWidth;
      const heightPct = (heightPx / heroHeight) * 100;
      const centerYPx = ((top + heightPct / 2) / 100) * heroHeight;
      return {
        type: 'photo',
        left: ((centerXPx - rotatedWidthPx / 2) / heroWidth) * 100,
        top: ((centerYPx - rotatedHeightPx / 2) / heroHeight) * 100,
        width: (rotatedWidthPx / heroWidth) * 100,
        height: (rotatedHeightPx / heroHeight) * 100,
      };
    });
}

function wait(duration) {
  return new Promise(resolve => window.setTimeout(resolve, duration));
}

function keepReloadAtKvTop() {
  if (document.documentElement.dataset.reloadAtTop !== 'true') return;
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);
}

function shuffleItems(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[targetIndex]] = [
      shuffled[targetIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function setResponsiveBackground(element, path) {
  if (!element || !path) return;
  element.dataset.kvImagePath = path;
  element.style.backgroundImage = `url("${path}.webp")`;
  element.style.backgroundImage = `image-set(url("${path}.avif") type("image/avif"), url("${path}.webp") type("image/webp"))`;
}

function setRandomPhotoDecor(block, path, slot, heroWidth, heroHeight) {
  const photo = block.closest('.kv-photo');
  if (!photo || !slot || !path) return Promise.resolve();

  photo.style.display = '';
  photo.style.right = 'auto';
  photo.style.bottom = 'auto';
  photo.style.height = 'auto';
  photo.style.maxWidth = `${maxKvPhotoWidthPx}px`;
  setResponsiveBackground(block, path);

  const applySlot = aspectRatio => {
    photo.style.aspectRatio = `${aspectRatio}`;
    const angle = (Math.abs(slot.rotate) * Math.PI) / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    // Rotated width = w*cos + h*sin, rotated height = w*sin + h*cos.
    // Solving both limits for w keeps the full tilted rectangle in its cell.
    const maxWidthFromRotatedWidth =
      slot.maxWidth / (cosine + sine / aspectRatio);
    const maxWidthFromRotatedHeight =
      (((slot.maxHeight / 100) * heroHeight) /
        (sine + cosine / aspectRatio) /
        heroWidth) *
      100;
    const maxWidthCapPct = (maxKvPhotoWidthPx / heroWidth) * 100;
    const width = Math.min(
      maxWidthFromRotatedWidth,
      maxWidthFromRotatedHeight,
      maxWidthCapPct
    );
    const heightPct =
      ((((width / 100) * heroWidth) / aspectRatio) / heroHeight) * 100;
    const rotatedWidthPct = width * (cosine + sine / aspectRatio);
    const rotatedHeightPct =
      width *
      (heroWidth / heroHeight) *
      (sine + cosine / aspectRatio);
    // Allow up to 3% of the rotated visual bounding box beyond the FV. This
    // keeps the ring expansive without forcing edge photos back into their
    // neighbours.
    const fvBleed = 3;
    const safeCenterX = Math.min(
      100 + fvBleed - rotatedWidthPct / 2,
      Math.max(-fvBleed + rotatedWidthPct / 2, slot.centerX)
    );
    const safeCenterY = Math.min(
      100 + fvBleed - rotatedHeightPct / 2,
      Math.max(-fvBleed + rotatedHeightPct / 2, slot.centerY)
    );
    photo.style.width = `${width}%`;
    photo.style.left = `${safeCenterX - width / 2}%`;
    photo.style.top = `${safeCenterY - heightPct / 2}%`;
    photo.style.rotate = `${slot.rotate}deg`;
  };

  const image = new Image();
  return new Promise(resolve => {
    image.onload = () => {
      const aspectRatio =
        image.naturalWidth && image.naturalHeight
          ? image.naturalWidth / image.naturalHeight
          : 3 / 2;
      applySlot(aspectRatio);
      resolve();
    };
    image.onerror = () => {
      applySlot(3 / 2);
      resolve();
    };
    image.src = `${path}.webp`;
  });
}

function createNonOverlappingPhotoRect(placement, aspectRatio, occupiedRects) {
  const minPhotoWidth = 18;
  const maxPhotoWidth = getMaxKvPhotoWidthPercent();
  const maxContentOverlapRatio = 0.1;
  const widthScales = [1.22, 1.14, 1.06, 1, 0.94, 0.88, 0.82];
  const gaps = [8, 6, 4, 2, 0];

  for (const gap of gaps) {
    for (const widthScale of widthScales) {
      for (let attempt = 0; attempt < 120; attempt++) {
        const baseWidth = randomBetween(...placement.width) * widthScale;
        const width = Math.min(
          maxPhotoWidth,
          Math.max(
            minPhotoWidth,
            aspectRatio < 1 ? baseWidth * 0.62 : baseWidth
          )
        );
        const height = width / aspectRatio;
        const maxLeft = Math.min(placement.x[1], 94 - width);
        const maxTop = Math.min(placement.y[1], 86 - height);
        if (maxLeft < placement.x[0] || maxTop < placement.y[0]) continue;

        const rect = {
          top: randomBetween(placement.y[0], maxTop),
          left: randomBetween(placement.x[0], maxLeft),
          width,
          height,
        };
        if (
          isAllowedKvPhotoRect(rect, occupiedRects, gap, maxContentOverlapRatio)
        ) {
          return rect;
        }
      }
    }
  }

  return createLeastOverlappingPhotoRect(placement, aspectRatio, occupiedRects);
}

function createLeastOverlappingPhotoRect(
  placement,
  aspectRatio,
  occupiedRects
) {
  const minPhotoWidth = 18;
  const maxPhotoWidth = getMaxKvPhotoWidthPercent();
  const maxContentOverlapRatio = 0.1;
  let bestRect;
  let bestOverlapArea = Infinity;

  for (let attempt = 0; attempt < 240; attempt++) {
    const baseWidth =
      randomBetween(...placement.width) * randomBetween(0.86, 1.08);
    const width = Math.min(
      maxPhotoWidth,
      Math.max(minPhotoWidth, aspectRatio < 1 ? baseWidth * 0.62 : baseWidth)
    );
    const height = width / aspectRatio;
    const maxLeft = Math.min(placement.x[1], 94 - width);
    const maxTop = Math.min(placement.y[1], 86 - height);
    if (maxLeft < placement.x[0] || maxTop < placement.y[0]) continue;

    const rect = {
      top: randomBetween(placement.y[0], maxTop),
      left: randomBetween(placement.x[0], maxLeft),
      width,
      height,
    };
    if (!isAllowedKvPhotoRect(rect, occupiedRects, 0, maxContentOverlapRatio)) {
      continue;
    }
    const overlapArea = occupiedRects.reduce(
      (total, occupied) => total + getRectOverlapArea(rect, occupied),
      0
    );
    if (overlapArea < bestOverlapArea) {
      bestRect = rect;
      bestOverlapArea = overlapArea;
    }
  }

  return bestRect || null;
}

function createFallbackPhotoRect(placement, aspectRatio) {
  const minPhotoWidth = 18;
  const maxPhotoWidth = getMaxKvPhotoWidthPercent();
  const baseWidth =
    randomBetween(...placement.width) * randomBetween(0.88, 1.12);
  const width = Math.min(
    maxPhotoWidth,
    Math.max(minPhotoWidth, aspectRatio < 1 ? baseWidth * 0.62 : baseWidth)
  );
  const height = width / aspectRatio;
  const left = Math.min(placement.x[1], Math.max(placement.x[0], 94 - width));
  const top = Math.min(placement.y[1], Math.max(placement.y[0], 86 - height));

  return { top, left, width, height };
}

function getKvContentProtectedRects() {
  const hero = document.querySelector('.kv-hero');
  const heroRect = hero?.getBoundingClientRect();
  if (!hero || !heroRect?.width || !heroRect.height) return [];
  return getKvProtectedElementRects(
    hero,
    heroRect.width,
    heroRect.height
  );
}

function isAllowedKvPhotoRect(
  rect,
  occupiedRects,
  gap,
  maxContentOverlapRatio
) {
  const maxContentOverlapArea =
    rect.width * rect.height * maxContentOverlapRatio;
  return occupiedRects.every(occupied => {
    if (occupied.type === 'content') {
      return getRectOverlapArea(rect, occupied) <= maxContentOverlapArea;
    }
    return !rectsOverlap(rect, occupied, gap);
  });
}

function getMaxKvPhotoWidthPercent() {
  const viewportWidth =
    window.innerWidth ||
    document.documentElement.clientWidth ||
    maxKvPhotoWidthPx;
  return (maxKvPhotoWidthPx / viewportWidth) * 100;
}

function getRectOverlapArea(rect, otherRect) {
  const overlapWidth = Math.max(
    0,
    Math.min(rect.left + rect.width, otherRect.left + otherRect.width) -
      Math.max(rect.left, otherRect.left)
  );
  const overlapHeight = Math.max(
    0,
    Math.min(rect.top + rect.height, otherRect.top + otherRect.height) -
      Math.max(rect.top, otherRect.top)
  );
  return overlapWidth * overlapHeight;
}

function rectsOverlap(rect, otherRect, gap) {
  return !(
    rect.left + rect.width + gap <= otherRect.left ||
    otherRect.left + otherRect.width + gap <= rect.left ||
    rect.top + rect.height + gap <= otherRect.top ||
    otherRect.top + otherRect.height + gap <= rect.top
  );
}

function getKvDecorOccupiedRects(photoBlocks) {
  const hero = document.querySelector('.kv-hero');
  if (!hero) return [];
  const heroRect = hero.getBoundingClientRect();
  if (!heroRect.width || !heroRect.height) return [];
  const elements = [
    ...photoBlocks.map(block => block.closest('.kv-photo')),
    document.querySelector('.kv-message'),
  ].filter(Boolean);

  return elements.map(element => {
    const rect = element.getBoundingClientRect();
    return {
      left: ((rect.left - heroRect.left) / heroRect.width) * 100,
      top: ((rect.top - heroRect.top) / heroRect.height) * 100,
      width: (rect.width / heroRect.width) * 100,
      height: (rect.height / heroRect.height) * 100,
    };
  });
}

function setRandomDotDecor(dot, occupiedRects) {
  if (!dot) return null;
  // Keep the dot assets secondary to the larger surrounding photographs.
  const isNarrowViewport = window.innerWidth < 768;
  const baseSize = isNarrowViewport
    ? randomBetween(5.5, 7.5)
    : randomBetween(7, 9);
  const hero = document.querySelector('.kv-hero');
  const heroRect = hero?.getBoundingClientRect();
  if (!heroRect?.width || !heroRect.height) return null;

  let placedRect = null;
  let placedSize = baseSize;
  for (const scale of [1, 0.9, 0.8, 0.7]) {
    const size = baseSize * scale;
    const sizePx = size * parseFloat(getComputedStyle(document.documentElement).fontSize);
    const rawWidth = (sizePx / heroRect.width) * 100;
    const rawHeight = (sizePx / heroRect.height) * 100;
    // A square rotated by up to 60deg can approach a sqrt(2)-times bounding
    // box. Reserve that full footprint so its corners remain collision-free.
    const width = rawWidth * 1.42;
    const height = rawHeight * 1.42;
    for (let attempt = 0; attempt < 600; attempt++) {
      const rect = {
        left: randomBetween(1, Math.max(1, 99 - width)),
        top: randomBetween(1, Math.max(1, 99 - height)),
        width,
        height,
      };
      if (occupiedRects.every(occupied => !rectsOverlap(rect, occupied, 1))) {
        placedRect = rect;
        placedSize = size;
        break;
      }
    }
    if (placedRect) break;
  }

  if (!placedRect) {
    dot.style.display = 'none';
    return null;
  }

  dot.style.display = '';
  const placedSizePx =
    placedSize * parseFloat(getComputedStyle(document.documentElement).fontSize);
  const placedRawWidth = (placedSizePx / heroRect.width) * 100;
  const placedRawHeight = (placedSizePx / heroRect.height) * 100;
  dot.style.top = `${placedRect.top + (placedRect.height - placedRawHeight) / 2}%`;
  dot.style.left = `${placedRect.left + (placedRect.width - placedRawWidth) / 2}%`;
  dot.style.right = 'auto';
  dot.style.bottom = 'auto';
  dot.style.width = `${placedSize}rem`;
  dot.style.height = `${placedSize}rem`;
  const floatX = randomSignedBetween(10, 20);
  const floatY = -randomBetween(14, 26);
  dot.style.removeProperty('rotate');
  dot.style.setProperty('--dot-rotate', `${randomBetween(-60, 60)}deg`);
  dot.style.setProperty('--float-delay', `${randomBetween(-7, 0)}s`);
  dot.style.setProperty('--piko-duration', `${randomBetween(1.8, 3.2)}s`);
  dot.style.setProperty('--float-duration', `${randomBetween(7, 11)}s`);
  dot.style.setProperty('--float-x', `${floatX}px`);
  dot.style.setProperty('--float-y', `${floatY}px`);
  dot.style.setProperty('--float-x-mid', `${floatX * -0.55}px`);
  dot.style.setProperty('--float-y-mid', `${floatY * 0.45}px`);
  dot.style.setProperty('--float-x-end', `${floatX * 0.35}px`);
  dot.style.setProperty('--float-y-end', '8px');
  dot.style.setProperty('--float-rotate', `${randomSignedBetween(4, 8)}deg`);
  dot.style.setProperty(
    '--float-rotate-mid',
    `${randomSignedBetween(3, 6)}deg`
  );
  dot.style.setProperty(
    '--float-rotate-end',
    `${randomSignedBetween(2, 4)}deg`
  );
  return placedRect;
}

function randomSignedBetween(min, max) {
  return randomBetween(min, max) * (Math.random() < 0.5 ? -1 : 1);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function initializeMenu() {
  const header = document.querySelector('header');
  const button = header?.querySelector('button');
  const navigation = document.querySelector('#global-nav');
  if (!header || !button || !navigation) return;

  let open = false;
  const menuIcon = button.innerHTML;
  const closeIcon =
    '<span class="sr-only">メニューを閉じる</span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x menu-button__icon" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>';

  const render = () => {
    button.setAttribute('aria-expanded', String(open));
    button.innerHTML = open ? closeIcon : menuIcon;
    navigation.setAttribute('aria-hidden', String(!open));
    navigation.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    updateHeader();
  };

  const updateHeader = () => {
    const scrolled = window.scrollY > 40 && !open;
    header.classList.toggle('is-scrolled', scrolled);
  };

  button.addEventListener('click', () => {
    open = !open;
    render();
  });
  navigation.querySelectorAll('a').forEach(link =>
    link.addEventListener('click', () => {
      open = false;
      render();
    })
  );
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
}

function initializeAccordions() {
  document.querySelectorAll('#faq li').forEach(item => {
    const button = item.querySelector('button');
    const panel = item.querySelector('h3 + div');
    const icon = button?.querySelector('svg');
    if (!button || !panel) return;
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      panel.classList.toggle('is-open', !open);
      icon?.classList.toggle('is-open', !open);
    });
  });
}

function initializeTabsAndKeywords() {
  const requirements = document.querySelector('#requirements');
  const tabs = [...(requirements?.querySelectorAll('[role="tab"]') ?? [])];
  const tabsContainer = requirements?.querySelector('.requirements-tabs');
  const panels = [
    ...(requirements?.querySelectorAll('[role="tabpanel"]') ?? []),
  ];
  const revealTab = tab => {
    if (!tabsContainer || !tab || window.innerWidth >= 768) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    const visibleLeft = tabsContainer.scrollLeft;
    const visibleRight = visibleLeft + tabsContainer.clientWidth;
    if (left < visibleLeft || tab.offsetWidth > tabsContainer.clientWidth) {
      tabsContainer.scrollTo({ left, behavior: 'auto' });
    } else if (right > visibleRight) {
      tabsContainer.scrollTo({ left: right - tabsContainer.clientWidth, behavior: 'auto' });
    }
  };
  const selectTab = tab => {
    tabs.forEach(other => {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      other.tabIndex = selected ? 0 : -1;
      other.classList.toggle('is-selected', selected);
    });
    panels.forEach(panel => {
      const selected = panel.id === tab.getAttribute('aria-controls');
      panel.hidden = !selected;
      panel.classList.toggle('is-hidden', !selected);
    });
    revealTab(tab);
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('focus', () => revealTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[next]);
      tabs[next].focus({ preventScroll: true });
    });
  });
  const selectedTab = () => tabs.find(tab => tab.classList.contains('is-selected'));
  if (tabs.length) selectTab(selectedTab() ?? tabs[0]);
  window.addEventListener('resize', () => revealTab(selectedTab()));
  document.fonts?.ready.then(() => revealTab(selectedTab()));

}

function initializeEnvironmentImagePreload() {
  const section = document.querySelector('#environment');
  if (!section) return;
  const galleryImages = [
    ...section.querySelectorAll('.env-gallery img[loading="lazy"]'),
  ];
  const officeImages = [
    ...section.querySelectorAll('.env-slider img[loading="lazy"]'),
  ];

  const preloadImages = images => {
    images.forEach(image => {
      image.loading = 'eager';
      image.fetchPriority = 'high';
      const picture = image.closest('picture');
      picture?.querySelectorAll('source[srcset]').forEach(source => {
        source
          .getAttribute('srcset')
          ?.split(',')
          .forEach(candidate => {
            const url = candidate.trim().split(/\s+/)[0];
            if (url) preloadImage(new URL(url, document.baseURI).href);
          });
      });
      if (image.currentSrc || image.src)
        preloadImage(image.currentSrc || image.src);
    });
  };
  preloadImages(officeImages);
  if (!galleryImages.length) return;

  if (!('IntersectionObserver' in window)) {
    preloadImages(galleryImages);
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      preloadImages(galleryImages);
      observer.disconnect();
    },
    { rootMargin: '900px 0px', threshold: 0 }
  );
  observer.observe(section);
}

async function initializeParticles() {
  const host = document.querySelector('.kv-particles');
  if (!host) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'particle-canvas';
  host.append(canvas);

  let vertexShader = fallbackVertexShader;
  let fragmentShader = fallbackFragmentShader;
  try {
    [vertexShader, fragmentShader] = await Promise.all([
      fetch('assets/shader/particles.vert?v=particle-size-5').then(response => {
        if (!response.ok) throw new Error('Vertex shader could not be loaded');
        return response.text();
      }),
      fetch('assets/shader/particles.frag?v=particle-size-5').then(response => {
        if (!response.ok)
          throw new Error('Fragment shader could not be loaded');
        return response.text();
      }),
    ]);
  } catch {
    // Direct file previews can block fetch(). The embedded copies keep the KV
    // animation available while hosted pages continue using /assets/shader.
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#fffdef', 8, 15);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  camera.position.z = 8;

  const count = innerWidth < 768 ? 48 : 96;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const scales = new Float32Array(count);
  const palette = ['#f6a9b8', '#f8d98a', '#a9d8c8', '#9fc9ee', '#f7c8a6'].map(
    color => new THREE.Color(color)
  );
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 2.8 + Math.random() * 3.3;
    positions.set(
      [
        Math.cos(angle) * radius * 1.2,
        Math.sin(angle) * radius * 0.62,
        (Math.random() - 0.5) * 4.5,
      ],
      i * 3
    );
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.05 + Math.random() * 0.12;
    scales[i] = 0.06 + Math.random() * 0.14;
    const color = palette[Math.floor(Math.random() * palette.length)];
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  const uniforms = {
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uSizeMultiplier: { value: 1 },
  };
  const aboutSection = document.querySelector('#about');
  let targetSizeMultiplier = 1;
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(geometry, material));

  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const updateSizeMultiplier = () => {
    // Keep the particle scale constant. The previous scroll-triggered burst
    // drew attention to the animation itself, which the brief asks to avoid.
    targetSizeMultiplier = 1;
  };
  addEventListener('resize', resize);
  addEventListener('scroll', updateSizeMultiplier, { passive: true });
  addEventListener('resize', updateSizeMultiplier);
  addEventListener(
    'pointermove',
    event => {
      uniforms.uPointer.value.set(
        (event.clientX / innerWidth - 0.5) * 0.14,
        -(event.clientY / innerHeight - 0.5) * 0.08
      );
    },
    { passive: true }
  );
  resize();
  updateSizeMultiplier();

  const clock = new THREE.Clock();
  let frameId = null;
  let onScreen = true;
  let contextLost = false;
  const shouldRun = () => onScreen && !document.hidden && !contextLost;

  const stop = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };
  const render = () => {
    frameId = null;
    if (!shouldRun()) return;
    uniforms.uTime.value = reducedMotion ? 0 : clock.getElapsedTime();
    uniforms.uSizeMultiplier.value +=
      (targetSizeMultiplier - uniforms.uSizeMultiplier.value) * 0.08;
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(render);
  };
  const start = () => {
    if (frameId === null && shouldRun()) frameId = requestAnimationFrame(render);
  };

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    stop();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    start();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  new IntersectionObserver(
    entries => {
      onScreen = entries.some(entry => entry.isIntersecting);
      if (onScreen) start();
      else stop();
    },
    { threshold: 0 }
  ).observe(host);

  start();
}

function initializeScrollReveal() {
  const selectors = [
    '.section-header',
    '.about-copy',
    '.about-figure',
    '.product-figure',
    '.product-body',
    '.interview-card',
    '.keyword-featured',
    '.keyword-card',
    '.welfare-card',
    '.flow-card',
    '.faq-item',
    '.env-copy',
    '.env-grid-item',
    '.env-feature-card',
    '.entry-inner',
  ];
  const items = [...document.querySelectorAll(selectors.join(','))];
  if (!items.length) return;

  if (reducedMotion) {
    items.forEach(element => element.classList.add('reveal', 'is-visible'));
    return;
  }

  items.forEach(element => element.classList.add('reveal'));
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        const parent = element.parentElement;
        const group = parent
          ? [...parent.children].filter(child =>
              child.classList.contains('reveal')
            )
          : [element];
        const index = Math.max(0, group.indexOf(element));
        element.style.transitionDelay = `${Math.min(index, 6) * 80}ms`;
        element.classList.add('is-visible');
        obs.unobserve(element);
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
  );
  items.forEach(element => observer.observe(element));
}

function initializeKeywordPopovers() {
  const board = document.querySelector('.keyword-composition');
  if (!board) return;
  const items = [...board.querySelectorAll('.keyword-composition__item')];
  const desktop = window.matchMedia('(min-width: 48rem)');
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
  let active = null;
  const setExpanded = (item, expanded) => {
    item.classList.toggle('is-open', expanded);
    item.querySelector('.keyword-composition__trigger').setAttribute('aria-expanded', String(expanded));
    item.querySelector('.keyword-composition__description').hidden = !expanded;
  };
  const close = () => {
    items.forEach(item => setExpanded(item, false));
    active = null;
  };
  const position = item => {
    const panel = item.querySelector('.keyword-composition__description');
    const bounds = board.getBoundingClientRect();
    const anchor = item.querySelector('.keyword-composition__trigger').getBoundingClientRect();
    const viewport = window.visualViewport;
    const inset = 12;
    const gap = 12;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
    // Keep the card inside both the keyword frame and the visible viewport.
    const leftEdge = Math.max(bounds.left, viewportLeft) + inset;
    const rightEdge = Math.min(bounds.right, viewportLeft + viewportWidth) - inset;
    let topEdge = Math.max(bounds.top, viewportTop, headerBottom) + inset;
    let bottomEdge = Math.min(bounds.bottom, viewportTop + viewportHeight) - inset;
    // A tap near a screen edge must not immediately close the disclosure.
    // When little of the board is visible, use its full height on mobile.
    if (!desktop.matches && bottomEdge - topEdge < 120) {
      topEdge = bounds.top + inset;
      bottomEdge = bounds.bottom - inset;
    }
    if (rightEdge - leftEdge < 80 || bottomEdge - topEdge < 80 ||
        (desktop.matches && (anchor.bottom <= topEdge || anchor.top >= bottomEdge))) {
      close();
      return;
    }

    // Measure the unconstrained panel at its actual responsive width first.
    panel.style.setProperty('--panel-max-width', `${rightEdge - leftEdge}px`);
    panel.style.removeProperty('--panel-max-height');
    const width = panel.offsetWidth;
    const naturalHeight = panel.offsetHeight;
    const below = Math.max(0, bottomEdge - anchor.bottom - gap);
    const above = Math.max(0, anchor.top - topEdge - gap);
    const useBelow = below >= naturalHeight || (above < naturalHeight && below >= above);
    const availableHeight = useBelow ? below : above;
    // If neither side has readable space, use the frame's visible area.
    // Long descriptions scroll inside the card instead of crossing the frame.
    const useFrame = availableHeight < Math.min(naturalHeight, 120);
    const maxHeight = useFrame ? bottomEdge - topEdge : availableHeight;
    panel.style.setProperty('--panel-max-height', `${maxHeight}px`);
    panel.classList.toggle('is-scrollable', naturalHeight > maxHeight);
    const height = panel.offsetHeight;
    const left = Math.max(leftEdge, Math.min(
      anchor.left + (anchor.width - width) / 2,
      rightEdge - width
    ));
    const preferredTop = useBelow ? anchor.bottom + gap : anchor.top - gap - height;
    const top = Math.max(topEdge, Math.min(preferredTop, bottomEdge - height));
    // Absolute positioning uses the keyword board as its containing block.
    panel.style.setProperty('--panel-left', `${left - bounds.left}px`);
    panel.style.setProperty('--panel-top', `${top - bounds.top}px`);
  };
  const open = item => {
    items.forEach(other => setExpanded(other, other === item));
    active = item;
    position(item);
  };

  items.forEach(item => {
    const summary = item.querySelector('.keyword-composition__trigger');
    summary.addEventListener('pointerenter', event => {
      if (desktop.matches && hover.matches && event.pointerType !== 'touch') open(item);
    });
    summary.addEventListener('pointerleave', () => {
      if (desktop.matches && active === item) close();
    });
    summary.addEventListener('focus', () => {
      if (desktop.matches) open(item);
    });
    summary.addEventListener('blur', () => {
      if (desktop.matches && active === item) close();
    });
    summary.addEventListener('click', event => {
      event.preventDefault();
      if (!desktop.matches && active === item) {
        close();
        return;
      }
      open(item);
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      close();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (active && !board.contains(event.target)) close();
  });
  desktop.addEventListener('change', close);
  let positionFrame = 0;
  const updatePosition = () => {
    if (!active || positionFrame) return;
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      if (active) position(active);
    });
  };
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', updatePosition, { passive: true });
  window.visualViewport?.addEventListener('resize', updatePosition);
  window.visualViewport?.addEventListener('scroll', updatePosition);
  document.fonts?.ready.then(updatePosition);
}

const showLoadingScreen = shouldShowLoadingScreen();
const kvLoaderSequence = showLoadingScreen ? prepareKvLoaderSequence() : null;
const kvDecorReady = initializeKvRandomDecor();
const kvLoadingReady = showLoadingScreen
  ? initializeLoadingScreen([kvDecorReady], kvLoaderSequence)
  : Promise.resolve(skipLoadingScreen());
Promise.all([kvDecorReady, kvLoadingReady]).then(() => {
  document.documentElement.style.removeProperty('scroll-behavior');
  startKvImageRotation([...document.querySelectorAll('.kv-photo')]);
});
initializeMenu();
initializeAccordions();
initializeTabsAndKeywords();
initializeKeywordPopovers();
initializeScrollReveal();
initializeEnvironmentImagePreload();
initializeParticles();
