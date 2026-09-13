import * as THREE from './three.module.min.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

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
  const marker = tabsContainer?.querySelector('.requirements-tabs__marker');
  const panels = [
    ...(requirements?.querySelectorAll('[role="tabpanel"]') ?? []),
  ];
  const updateMarker = tab => {
    if (!tabsContainer || !marker || !tab) return;
    const inset = window.innerWidth >= 768 ? 48 : 16;
    tabsContainer.style.setProperty(
      '--marker-x',
      `${tab.offsetLeft + inset}px`
    );
    tabsContainer.style.setProperty(
      '--marker-width',
      `${Math.max(0, tab.offsetWidth - inset * 2)}px`
    );
  };
  tabs.forEach((tab, index) =>
    tab.addEventListener('click', () => {
      tabs.forEach((other, otherIndex) => {
        const selected = index === otherIndex;
        other.setAttribute('aria-selected', String(selected));
        other.classList.toggle('is-selected', selected);
      });
      updateMarker(tab);
      panels.forEach(panel => {
        const selected = panel.id === tab.getAttribute('aria-controls');
        panel.hidden = !selected;
        panel.classList.toggle('is-hidden', !selected);
      });
    })
  );
  updateMarker(tabs.find(tab => tab.classList.contains('is-selected')));
  window.addEventListener('resize', () => {
    updateMarker(tabs.find(tab => tab.classList.contains('is-selected')));
  });

}

function initializeKineticKeywords() {
  const grid = document.querySelector('.keyword-grid');
  const cards = [...document.querySelectorAll('.keyword-grid > article')];
  const host = grid?.querySelector('.keyword-webgl');
  if (!grid || !host || !cards.length || reducedMotion) return;

  const canvas = document.createElement('canvas');
  host.append(canvas);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 160);
  camera.position.set(0, 0.4, 54);
  const spiral = new THREE.Group();
  spiral.position.y = 1.3;
  scene.add(spiral);

  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const rayPointer = new THREE.Vector2();
  let isPaused = false;
  let travelTime = 0;
  let lastElapsed = 0;
  const palette = [
    ['#f8d7bf', '#fff7bd', '#d9e3dd'],
    ['#dce6de', '#fffdef', '#f4ccb8'],
    ['#fff0b7', '#e8eef4', '#f8d7bf'],
  ];

  const makeTexture = (card, index) => {
    const number =
      card.querySelector('p:first-child')?.textContent?.trim() ?? '';
    const label = card.querySelector('h3')?.textContent?.trim() ?? '';
    const paragraphs = [...card.querySelectorAll('p')].slice(1);
    const value = paragraphs.map(item => item.textContent.trim()).join(' / ');
    const width = value.length > 34 ? 1360 : value.length > 18 ? 1120 : 860;
    const height = value.length > 18 ? 660 : 560;
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = width;
    textureCanvas.height = height;
    const context = textureCanvas.getContext('2d');
    const colors = palette[index % palette.length];

    context.fillStyle = '#fffdef';
    context.fillRect(0, 0, width, height);
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.52, colors[1]);
    gradient.addColorStop(1, colors[2]);
    context.globalAlpha = 0.86;
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.globalAlpha = 1;
    context.strokeStyle = 'rgba(37, 37, 37, 0.13)';
    context.lineWidth = 8;
    context.strokeRect(4, 4, width - 8, height - 8);

    context.fillStyle = '#d72b2f';
    context.font = '700 34px sans-serif';
    context.letterSpacing = '4px';
    context.fillText(number, 52, 82);
    context.fillRect(52, 106, 70, 4);

    context.fillStyle = 'rgba(37, 37, 37, 0.58)';
    context.font = '700 40px sans-serif';
    wrapCanvasText(context, label, 52, 166, width - 104, 54, 2);

    context.fillStyle = '#252525';
    fitCanvasText(context, value, {
      x: 52,
      y: 270,
      maxWidth: width - 104,
      maxHeight: height - 320,
      maxLines: 5,
      fontFamily: 'serif',
      maxFontSize: 60,
      minFontSize: 46,
      lineRatio: 1.22,
    });

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { texture, aspect: width / height };
  };

  const helixTurns = 2.15;
  const helixHeight = 22;
  const helixRadius = 9.2;
  const getHelixState = progress => {
    const angle = progress * Math.PI * 2 * helixTurns - 1.35;
    return {
      angle,
      position: new THREE.Vector3(
        Math.cos(angle) * helixRadius,
        -helixHeight / 2 + progress * helixHeight,
        Math.sin(angle) * helixRadius
      ),
    };
  };
  const initialFrontPhase = (Math.PI / 2 + 1.35) / (Math.PI * 2 * helixTurns);

  const meshes = cards.map((card, index) => {
    const { texture, aspect } = makeTexture(card, index);
    const geometry = new THREE.PlaneGeometry(4.15 * aspect, 4.15);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const phase = (initialFrontPhase - index / cards.length + 1) % 1;
    const { angle, position } = getHelixState(phase);
    mesh.position.copy(position);
    mesh.rotation.z = (index % 2 ? -1 : 1) * (0.04 + index * 0.0025);
    mesh.userData.baseScale = 1.1 + Math.sin(index * 0.7) * 0.04;
    mesh.userData.phase = phase;
    mesh.scale.setScalar(mesh.userData.baseScale);
    spiral.add(mesh);
    return mesh;
  });

  const helixCurve = new THREE.CatmullRomCurve3(
    Array.from(
      { length: 220 },
      (_, index) => getHelixState(index / 219).position
    )
  );
  const helixGeometry = new THREE.BufferGeometry().setFromPoints(
    helixCurve.getPoints(180)
  );
  const helixLine = new THREE.Line(
    helixGeometry,
    new THREE.LineBasicMaterial({
      color: '#d72b2f',
      transparent: true,
      opacity: 0.28,
    })
  );
  spiral.add(helixLine);

  spiral.rotation.x = -0.1;
  spiral.rotation.y = -0.35;

  const resize = () => {
    const width = Math.ceil(canvas.offsetWidth || host.clientWidth);
    const height = Math.ceil(canvas.offsetHeight || host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  host.addEventListener(
    'pointermove',
    event => {
      const rect = canvas.getBoundingClientRect();
      rayPointer.set(
        ((event.clientX - rect.left) / rect.width - 0.5) * 2,
        -((event.clientY - rect.top) / rect.height - 0.5) * 2
      );
      raycaster.setFromCamera(rayPointer, camera);
      spiral.updateMatrixWorld(true);
      isPaused = raycaster
        .intersectObjects(meshes, false)
        .some(hit => hit.object.material.opacity > 0.18);
      pointer.set(
        isPaused ? rayPointer.x * 0.5 : 0,
        isPaused ? -rayPointer.y * 0.5 : 0
      );
    },
    { passive: true }
  );
  host.addEventListener('pointerleave', () => {
    isPaused = false;
    pointer.set(0, 0);
  });
  addEventListener('resize', resize);
  resize();

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
    const elapsed = clock.getElapsedTime();
    const delta = elapsed - lastElapsed;
    lastElapsed = elapsed;
    if (!isPaused) travelTime += delta;
    const targetY = -0.35 + pointer.x * 0.85;
    spiral.rotation.y += (targetY - spiral.rotation.y) * 0.05;
    spiral.rotation.x += (-0.08 - pointer.y * 0.32 - spiral.rotation.x) * 0.05;
    meshes.forEach((mesh, index) => {
      const progress = (mesh.userData.phase + travelTime * 0.012) % 1;
      const { position } = getHelixState(progress);
      position.y += Math.sin(travelTime * 1.2 + index) * 0.04;
      mesh.position.copy(position);
      mesh.quaternion.copy(camera.quaternion);
      mesh.rotateZ((index % 2 ? -1 : 1) * (0.04 + index * 0.0025));
      const depthScale = 0.94 + progress * 0.12;
      mesh.scale.setScalar(mesh.userData.baseScale * depthScale);
      const fadeIn = smoothstep(0.04, 0.16, progress);
      const fadeOut = 1 - smoothstep(0.84, 0.96, progress);
      mesh.material.opacity = fadeIn * fadeOut;
    });
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(render);
  };
  const start = () => {
    if (frameId === null && shouldRun()) {
      lastElapsed = clock.getElapsedTime();
      frameId = requestAnimationFrame(render);
    }
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
  ).observe(grid);

  start();
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const characters = [...text];
  let line = '';
  const lines = [];
  for (const character of characters) {
    const testLine = line + character;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = character;
      if (lines.length === maxLines) break;
    } else {
      line = testLine;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => {
    const clipped =
      index === maxLines - 1 && characters.join('') !== lines.join('');
    context.fillText(`${item}${clipped ? '…' : ''}`, x, y + index * lineHeight);
  });
}

function fitCanvasText(context, text, options) {
  const {
    x,
    y,
    maxWidth,
    maxHeight,
    maxLines,
    fontFamily,
    maxFontSize,
    minFontSize,
    lineRatio,
  } = options;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    context.font = `700 ${fontSize}px ${fontFamily}`;
    const lineHeight = Math.round(fontSize * lineRatio);
    const lines = buildCanvasLines(context, text, maxWidth, maxLines);
    if (lines.length * lineHeight <= maxHeight) {
      lines.forEach((line, index) => {
        context.fillText(line, x, y + index * lineHeight);
      });
      return;
    }
  }

  context.font = `700 ${minFontSize}px ${fontFamily}`;
  const lineHeight = Math.round(minFontSize * lineRatio);
  buildCanvasLines(context, text, maxWidth, maxLines).forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });
}

function buildCanvasLines(context, text, maxWidth, maxLines) {
  const characters = [...text];
  const lines = [];
  let line = '';
  for (const character of characters) {
    const testLine = line + character;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = character;
      if (lines.length === maxLines) break;
    } else {
      line = testLine;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && lines.join('') !== text) {
    lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
  }
  return lines;
}

function smoothstep(edge0, edge1, value) {
  const amount = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return amount * amount * (3 - 2 * amount);
}

function initializePathDecorations() {
  const decorations = [
    {
      selector: '#about',
      variant: 'ribbon-arc',
      placement: 'right-high',
      paths: ['M1200 -220 A620 860 0 0 0 1200 1260'],
    },
    {
      selector: '#products',
      variant: 'ribbon-line',
      placement: 'line-low',
      count: 1,
      paths: ['M-120 430 L1120 38', 'M-120 246 L1120 468'],
    },
    {
      selector: '#interview',
      variant: 'ribbon-arc',
      placement: 'left-hero',
      paths: ['M-320 -300 A920 940 0 0 1 -320 1360'],
    },
    {
      selector: '#keyword',
      variant: 'ribbon-line',
      placement: 'line-high',
      count: 1,
      paths: ['M-120 222 L1120 148'],
    },
    {
      selector: '#environment',
      variant: 'ribbon-arc',
      placement: 'right-hero',
      paths: ['M1260 -420 A1180 1540 0 0 0 1260 1660'],
    },
    {
      selector: '#welfare',
      variant: 'ribbon-line',
      placement: 'line-middle',
      count: 2,
      paths: ['M-120 382 L1120 88', 'M-120 136 L1120 390'],
    },
    {
      selector: '#requirements',
      variant: 'ribbon-arc',
      placement: 'left-middle',
      paths: ['M-320 -200 A680 850 0 0 1 -320 1240'],
    },
    {
      selector: '#faq',
      variant: 'ribbon-arc',
      placement: 'left-high',
      paths: ['M-320 -260 A1040 900 0 0 1 -320 1320'],
    },
  ];

  decorations.forEach(
    ({ selector, variant, placement, paths, count }, index) => {
      const section = document.querySelector(selector);
      if (!section || section.querySelector('.section-path-decor')) return;
      section.classList.add('has-section-path');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add(
        'section-path-decor',
        `section-path-decor--${variant}`,
        `section-path-decor--${placement}`
      );
      svg.setAttribute(
        'viewBox',
        variant === 'ribbon-arc' ? '-320 -320 1520 1760' : '0 0 1000 520'
      );
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      const defs = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'defs'
      );
      const gradient = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'linearGradient'
      );
      const gradientId = `section-path-gradient-${section.id || index}`;
      gradient.setAttribute('id', gradientId);
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('x2', '100%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('y2', '100%');
      [
        ['0%', '#f5b8b7'],
        ['28%', '#f7df9a'],
        ['54%', '#c9dec1'],
        ['78%', '#cbd8f2'],
        ['100%', '#fffdef'],
      ].forEach(([offset, color]) => {
        const stop = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'stop'
        );
        stop.setAttribute('offset', offset);
        stop.setAttribute('stop-color', color);
        gradient.append(stop);
      });
      defs.append(gradient);
      svg.append(defs);
      const stickerPaths = paths;
      stickerPaths
        .slice(0, count ?? stickerPaths.length)
        .forEach((pathData, pathIndex) => {
          const element = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path'
          );
          const randomSeed = index * 13 + pathIndex * 7;
          element.setAttribute('d', pathData);
          element.setAttribute('pathLength', '1');
          element.setAttribute('stroke', `url(#${gradientId})`);
          element.classList.toggle(
            'is-reverse-draw',
            variant === 'ribbon-line' && pathIndex % 2 === 1
          );
          element.style.stroke = `url(#${gradientId})`;
          element.style.setProperty(
            '--path-delay',
            `${pathIndex * 0.24 + index * 0.04}s`
          );
          element.style.setProperty(
            '--path-duration',
            `${5.8 + (randomSeed % 5) * 0.55}s`
          );
          element.style.setProperty(
            '--path-drift-x',
            `${(randomSeed % 2 ? 1 : -1) * (10 + (randomSeed % 4) * 4)}px`
          );
          element.style.setProperty(
            '--path-drift-y',
            `${((randomSeed % 3) - 1) * 10}px`
          );
          element.style.setProperty(
            '--path-rotate',
            `${(randomSeed % 7) - 3}deg`
          );
          svg.append(element);
        });
      section.prepend(svg);
    }
  );

  const paths = [...document.querySelectorAll('.section-path-decor path')];
  paths.forEach(path => {
    const length = path.getTotalLength();
    path.style.setProperty('--path-length', length);
  });

  if (reducedMotion) {
    document.querySelectorAll('.has-section-path').forEach(section => {
      section.classList.add('is-path-visible');
    });
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const section = entry.target.matches('.has-section-path')
          ? entry.target
          : entry.target.closest('.has-section-path');
        section?.classList.add('is-path-visible');
      });
    },
    { rootMargin: '0px 0px -50% 0px', threshold: 0 }
  );
  document
    .querySelectorAll('.has-section-path')
    .forEach(element => observer.observe(element));
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

function initializeKeywordMosaic() {
  const section = document.querySelector('#keyword');
  const board = section?.querySelector('.keyword-mosaic__board');
  const detail = section?.querySelector('.keyword-mosaic__detail');
  const cards = section
    ? [...section.querySelectorAll('.keyword-grid > .keyword-card')]
    : [];
  if (!section || !board || !detail || !cards.length) return;

  const items = cards.map((card, index) => ({
    index,
    number: card.querySelector('.keyword-card__number')?.textContent?.trim() || '',
    label: card.querySelector('.keyword-card__label')?.textContent?.trim() || '',
    values: (card.querySelector('.keyword-card__value')?.innerHTML || '')
      .split(/<br\s*\/?>/i)
      .map(value => value.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean),
    photo: `assets/images/keyword-tape/tape-${String(index + 1).padStart(2, '0')}.webp`,
  }));
  const narrowQuery = window.matchMedia('(max-width: 47.9375rem)');
  let activeIndex = null;
  let pinnedIndex = null;
  let activeDotImages = [];
  const dotNumbers = [
    ...Array.from({ length: 18 }, (_, index) => index + 1),
    ...Array.from({ length: 27 }, (_, index) => index + 22),
    ...Array.from({ length: 13 }, (_, index) => index + 63),
  ];
  const dotImages = dotNumbers.map(
    number => `assets/images/kv-random/dots/dot-${String(number).padStart(3, '0')}.webp`
  );
  const chooseDotImages = count => {
    const pool = [...dotImages];
    for (let index = pool.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[target]] = [pool[target], pool[index]];
    }
    return pool.slice(0, count);
  };

  const characterWidth = label =>
    Array.from(label).reduce(
      (sum, character) => sum + (/^[\x20-\x7e]$/.test(character) ? 0.55 : 1),
      0
    );
  const widthFor = width => {
    if (width <= 6) return 2;
    if (width <= 8) return 3;
    if (width <= 12) return 4;
    return 5;
  };
  const pack = columns => {
    const shaped = items
      .map(item => ({
        index: item.index,
        width: Math.min(widthFor(characterWidth(item.label)), columns),
      }))
      .sort((a, b) => b.width - a.width);
    const packedRows = [];
    shaped.forEach(block => {
      const row = packedRows.find(
        candidate =>
          candidate.reduce((sum, item) => sum + item.width, 0) + block.width <= columns
      );
      if (row) row.push(block);
      else packedRows.push([block]);
    });
    const pieces = [];
    packedRows.forEach((row, rowIndex) => {
      const slack = columns - row.reduce((sum, block) => sum + block.width, 0);
      const share = Math.floor(slack / row.length);
      let extra = slack - share * row.length;
      let column = 0;
      row.forEach(block => {
        const width = block.width + share + (extra > 0 ? 1 : 0);
        if (extra > 0) extra -= 1;
        pieces.push({
          index: block.index,
          column,
          row: rowIndex * 2,
          width,
          height: 2,
        });
        column += width;
      });
    });
    return { pieces, rows: packedRows.length * 2 };
  };

  const renderDetail = index => {
    const item = index === null ? null : items[index];
    if (!item) {
      detail.replaceChildren();
      return;
    }
    const values = item.values
      .map((value, valueIndex) => `<p class="${valueIndex === 0 ? (value.length <= 16 ? 'keyword-mosaic__value-main' : 'keyword-mosaic__value-main keyword-mosaic__value-main--long') : 'keyword-mosaic__value-sub'}">${value}</p>`)
      .join('');
    detail.innerHTML = `<div class="keyword-mosaic__detail-copy"><p class="keyword-mosaic__detail-label">${item.label}</p><div>${values}</div></div>`;
  };

  const activate = index => {
    const shouldRefreshImages = index !== null && index !== activeIndex;
    if (shouldRefreshImages) activeDotImages = chooseDotImages(12);
    if (index === null) activeDotImages = [];
    activeIndex = index;
    board.querySelectorAll('.keyword-mosaic__piece').forEach(piece => {
      const isActive = Number(piece.dataset.keywordIndex) === index;
      piece.classList.toggle('is-active', isActive);
      piece.classList.toggle('is-dimmed', index !== null && !isActive);
      piece.setAttribute('aria-pressed', String(isActive));
    });
    board.querySelector('.keyword-mosaic__tape')?.remove();
    if (index !== null && activeDotImages.length) {
      const tape = document.createElement('div');
      const imageMarkup = activeDotImages
        .map(source => `<span><img src="${source}" alt="" /></span>`)
        .join('');
      tape.className = 'keyword-mosaic__tape';
      tape.innerHTML = `<div class="keyword-mosaic__tape-track"><div>${imageMarkup}</div><div aria-hidden="true">${imageMarkup}</div></div>`;
      board.append(tape);
    }
    renderDetail(index);
  };

  const build = () => {
    const columns = narrowQuery.matches ? 6 : 14;
    const { pieces, rows } = pack(columns);
    board.replaceChildren();
    board.dataset.rows = String(rows);
    board.style.aspectRatio = `${columns} / ${rows}`;
    board.style.setProperty('--keyword-columns', columns);
    pieces.forEach(piece => {
      const item = items[piece.index];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'keyword-mosaic__piece';
      button.dataset.keywordIndex = String(piece.index);
      button.dataset.row = String(piece.row);
      button.setAttribute('aria-label', `${item.label} — ${item.values.join(' ')}`);
      button.setAttribute('aria-pressed', 'false');
      button.style.left = `${(piece.column / columns) * 100}%`;
      button.style.top = `${(piece.row / rows) * 100}%`;
      button.style.width = `${(piece.width / columns) * 100}%`;
      button.style.height = `${(piece.height / rows) * 100}%`;
      button.innerHTML = `<span class="keyword-mosaic__surface"><span>${item.label}</span></span>`;
      button.addEventListener('pointerenter', () => activate(piece.index));
      button.addEventListener('pointerleave', () => activate(pinnedIndex));
      button.addEventListener('focus', () => activate(piece.index));
      button.addEventListener('blur', () => activate(pinnedIndex));
      button.addEventListener('click', () => {
        pinnedIndex = pinnedIndex === piece.index ? null : piece.index;
        activate(pinnedIndex);
      });
      board.append(button);
    });
    activate(activeIndex);
  };

  build();
  narrowQuery.addEventListener?.('change', build);
}

function initializeKeywordGeometric(section, cards) {
  const host = section?.querySelector('.keyword-geometric');
  const board = host?.querySelector('.keyword-geometric__board');
  const detail = host?.querySelector('.keyword-geometric__detail');
  if (!host || !board || !detail || !cards.length) return;

  const narrowQuery = window.matchMedia('(max-width: 47.9375rem)');
  let pinnedIndex = null;

  const getItems = () =>
    cards.map((card, index) => ({
      index,
      number: card.querySelector('.keyword-card__number')?.textContent || '',
      label: card.querySelector('.keyword-card__label')?.textContent || '',
      value: card.querySelector('.keyword-card__value')?.innerHTML || '',
    }));

  const packItems = (items, columns) => {
    const grid = [];
    const ensureRow = row => {
      while (grid.length <= row) grid.push(Array(columns).fill(false));
    };
    const shaped = items
      .map(item => {
        const chars = Array.from(item.label);
        let shape = { width: 1, height: chars.length, score: Infinity };
        for (let width = 1; width <= Math.min(columns, 5, chars.length); width++) {
          const height = Math.ceil(chars.length / width);
          const score = (width * height - chars.length) * 1.5 +
            Math.abs(width - height);
          if (score < shape.score) shape = { width, height, score };
        }
        return { ...item, chars, ...shape };
      })
      .sort((a, b) =>
        b.width * b.height - a.width * a.height || b.height - a.height
      );

    return shaped.map(piece => {
      for (let row = 0; ; row++) {
        ensureRow(row + piece.height - 1);
        for (let column = 0; column <= columns - piece.width; column++) {
          let fits = true;
          for (let y = row; y < row + piece.height && fits; y++) {
            for (let x = column; x < column + piece.width; x++) {
              if (grid[y][x]) fits = false;
            }
          }
          if (!fits) continue;
          for (let y = row; y < row + piece.height; y++) {
            for (let x = column; x < column + piece.width; x++) {
              grid[y][x] = true;
            }
          }
          return { ...piece, row, column, rows: grid.length };
        }
      }
    });
  };

  const showDetail = index => {
    const item = getItems()[index];
    if (!item) return;
    const activePiece = [...board.children].find(
      piece => Number(piece.dataset.keywordIndex) === index
    );
    [...board.children].forEach(piece => {
      const active = Number(piece.dataset.keywordIndex) === index;
      piece.classList.toggle('is-active', active);
      piece.classList.toggle('is-dimmed', !active);
      piece.setAttribute('aria-pressed', String(active));
    });
    detail.innerHTML = `<p class="keyword-geometric__detail-number">${item.number}</p><h3>${item.label}</h3><div>${item.value}</div>`;
    detail.classList.remove(
      'is-at-top',
      'is-at-bottom',
      'is-at-left',
      'is-at-right'
    );
    if (activePiece) {
      const centerX = Number(activePiece.dataset.column) +
        Number(activePiece.dataset.pieceWidth) / 2;
      const centerY = Number(activePiece.dataset.row) +
        Number(activePiece.dataset.pieceHeight) / 2;
      const columns = Number(board.style.getPropertyValue('--geometric-columns'));
      const rows = Number(board.style.getPropertyValue('--geometric-rows'));
      detail.classList.add(centerY < rows / 2 ? 'is-at-bottom' : 'is-at-top');
      detail.classList.add(centerX < columns / 2 ? 'is-at-right' : 'is-at-left');
    }
    detail.classList.add('is-visible');
  };

  const clearDetail = () => {
    [...board.children].forEach(piece => {
      piece.classList.remove('is-active', 'is-dimmed');
      piece.setAttribute('aria-pressed', 'false');
    });
    detail.classList.remove('is-visible');
    detail.innerHTML = '<p>キーワードにカーソルを重ねると詳細が表示されます</p>';
  };

  const build = () => {
    const columns = narrowQuery.matches ? 6 : 12;
    const pieces = packItems(getItems(), columns);
    const rows = Math.max(...pieces.map(piece => piece.row + piece.height));
    board.replaceChildren();
    board.style.setProperty('--geometric-columns', columns);
    board.style.setProperty('--geometric-rows', rows);

    pieces.forEach(piece => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'keyword-geometric__piece';
      button.dataset.keywordIndex = String(piece.index);
      button.dataset.column = String(piece.column);
      button.dataset.row = String(piece.row);
      button.dataset.pieceWidth = String(piece.width);
      button.dataset.pieceHeight = String(piece.height);
      button.setAttribute('aria-label', `${piece.label}：${piece.value.replace(/<br\s*\/?>/gi, ' ')}`);
      button.setAttribute('aria-pressed', 'false');
      button.style.gridColumn = `${piece.column + 1} / span ${piece.width}`;
      button.style.gridRow = `${piece.row + 1} / span ${piece.height}`;
      button.style.setProperty('--piece-columns', piece.width);
      button.style.setProperty('--piece-rows', piece.height);

      piece.chars.forEach((character, characterIndex) => {
        const cell = document.createElement('span');
        cell.className = 'keyword-geometric__cell';
        cell.style.setProperty('--cell-order', characterIndex);
        cell.textContent = character;
        button.append(cell);
      });
      for (let empty = piece.chars.length;
        empty < piece.width * piece.height;
        empty++) {
        const cell = document.createElement('span');
        cell.className = 'keyword-geometric__cell is-empty';
        button.append(cell);
      }

      button.addEventListener('pointerenter', () => showDetail(piece.index));
      button.addEventListener('pointerleave', () => {
        if (pinnedIndex === null) clearDetail();
        else showDetail(pinnedIndex);
      });
      button.addEventListener('focus', () => showDetail(piece.index));
      button.addEventListener('blur', () => {
        if (pinnedIndex === null) clearDetail();
      });
      button.addEventListener('click', () => {
        pinnedIndex = pinnedIndex === piece.index ? null : piece.index;
        if (pinnedIndex === null) clearDetail();
        else showDetail(pinnedIndex);
      });
      board.append(button);
    });
    if (pinnedIndex !== null) showDetail(pinnedIndex);
  };

  build();
  narrowQuery.addEventListener?.('change', build);
}

function initializeKeywordDesigns() {
  const section = document.querySelector('#keyword');
  const cards = section
    ? [...section.querySelectorAll('.keyword-grid > .keyword-card')]
    : [];
  const tabs = section
    ? [...section.querySelectorAll('.keyword-designs__tab')]
    : [];
  const stage = section?.querySelector('.keyword-stage');
  const stageNumber = stage?.querySelector('.keyword-stage__number');
  const stageLabel = stage?.querySelector('.keyword-stage__label');
  const stageValue = stage?.querySelector('.keyword-stage__value');
  if (
    !section ||
    !cards.length ||
    !tabs.length ||
    !stageNumber ||
    !stageLabel ||
    !stageValue
  ) {
    return;
  }

  let activeIndex = 0;

  const tapeLibrary = section.querySelector('.keyword-tape-library');
  const tapeList = tapeLibrary?.querySelector('.keyword-tape-library__list');
  const tapeDetail = tapeLibrary?.querySelector('.keyword-tape-library__detail');

  const renderTapeDetail = index => {
    const card = cards[index];
    if (!card || !tapeDetail || !tapeList) return;
    const number = card.querySelector('.keyword-card__number')?.textContent || '';
    const label = card.querySelector('.keyword-card__label')?.textContent || '';
    const value = [...card.querySelectorAll('.keyword-card__value')]
      .map(element => element.innerHTML.trim())
      .join('<br>');
    tapeDetail.innerHTML = `
      <p class="keyword-tape-library__eyebrow">KEYWORD ${number}</p>
      <h3>${label}</h3>
      <div>${value}</div>
    `;
    [...tapeList.children].forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  if (tapeList && tapeDetail) {
    cards.forEach((card, index) => {
      const number = card.querySelector('.keyword-card__number')?.textContent || '';
      const label = card.querySelector('.keyword-card__label')?.textContent || '';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'keyword-tape-library__tape';
      button.innerHTML = `<span>${number}</span><strong>${label}</strong><i aria-hidden="true">＋</i>`;
      button.addEventListener('pointerenter', () => renderTapeDetail(index));
      button.addEventListener('focus', () => renderTapeDetail(index));
      button.addEventListener('click', () => renderTapeDetail(index));
      tapeList.append(button);
    });
    renderTapeDetail(0);
  }

  const renderStage = (index, animate = true) => {
    activeIndex = (index + cards.length) % cards.length;
    const card = cards[activeIndex];
    stageNumber.textContent = card.querySelector('.keyword-card__number')?.textContent || '';
    stageLabel.textContent = card.querySelector('.keyword-card__label')?.textContent || '';
    stageValue.innerHTML = [...card.querySelectorAll('.keyword-card__value')]
      .map(element => element.innerHTML.trim())
      .join('<br>');
    cards.forEach((item, index) => {
      item.classList.toggle('is-keyword-active', index === activeIndex);
      item.setAttribute('aria-pressed', String(index === activeIndex));
    });
    if (animate && !reducedMotion) {
      section.classList.remove('is-keyword-stage-changing');
      requestAnimationFrame(() =>
        section.classList.add('is-keyword-stage-changing')
      );
    }
  };

  cards.forEach((card, index) => {
    const angle = ((index / cards.length) * Math.PI * 2) - Math.PI / 2;
    card.style.setProperty('--keyword-x', `${50 + Math.cos(angle) * 44}%`);
    card.style.setProperty('--keyword-y', `${50 + Math.sin(angle) * 43}%`);
    card.style.setProperty('--keyword-order', index);
    card.style.setProperty(
      '--keyword-entry-x',
      '-5rem'
    );
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.addEventListener('click', () => {
      if (section.dataset.keywordView === 'constellation') {
        renderStage(index);
      }
    });
    card.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (section.dataset.keywordView === 'constellation') {
        renderStage(index);
      }
    });
  });

  const activateView = tab => {
    section.dataset.keywordView = tab.dataset.keywordView;
    tabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    });
    const cardsAreInteractive = tab.dataset.keywordView === 'constellation';
    cards.forEach(card => {
      const isEditorial = tab.dataset.keywordView === 'runway';
      card.tabIndex = cardsAreInteractive || isEditorial ? 0 : -1;
    });
    if (!reducedMotion) {
      section.classList.remove('is-keyword-view-entering');
      requestAnimationFrame(() =>
        section.classList.add('is-keyword-view-entering')
      );
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateView(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      activateView(tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  });
  renderStage(0, false);
  const initialTab = tabs.find(
    tab => tab.dataset.keywordView === section.dataset.keywordView
  ) || tabs[0];
  activateView(initialTab);
  initializeKeywordGeometric(section, cards);
}

keepReloadAtKvTop();
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
initializeKeywordMosaic();
initializeScrollReveal();
initializeEnvironmentImagePreload();
initializeParticles();
