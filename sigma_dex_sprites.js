/* Sigma-dex background sprites. Source: arvindfroi/sigma-dex, assets/sprites-ds.
   Render as decorative fixed artwork, never as a separate UI section. */
(() => {
  'use strict';
  const field = document.getElementById('spriteField');
  if (!field) return;
  const SOURCE_ROOT = 'https://raw.githubusercontent.com/arvindfroi/sigma-dex/main/assets/';
  const FALLBACK_ROOT = 'https://arvindfroi.github.io/sigma-dex/assets/';
  // Viewport positions (x %, y %, width px) are adapted from the standalone preview,
  // but all images are the actual original sprites from the Sigma-dex repository.
  const sprites = [{"name":"leafing","kind":"sprites-ds","d":[1.5,8,126],"m":[-4,10,80],"flip":1,"duration":13.0,"delay":0.0,"dx":6,"dy":8},{"name":"waffy","kind":"sprites-ds","d":[87,6,155],"m":[79,13,85],"flip":-1,"duration":14.7,"delay":-0.67,"dx":-11,"dy":-11},{"name":"erobi","kind":"sprites-ds","d":[6,31,83],"m":[-2,24,73],"flip":1,"duration":16.4,"delay":-1.34,"dx":16,"dy":-14},{"name":"bolthook","kind":"sprites-ds","d":[83,26,133],"m":[80,27,94],"flip":1,"duration":18.2,"delay":-2.01,"dx":-21,"dy":17},{"name":"harpie","kind":"sprites-ds","d":[1,51,174],"m":[-8,40,106],"flip":-1,"duration":19.9,"delay":-2.68,"dx":6,"dy":-20},{"name":"pipwi","kind":"sprites-ds","d":[88,49,97],"m":[81,43,75],"flip":1,"duration":21.6,"delay":-3.35,"dx":-11,"dy":-8},{"name":"icy-freeze","kind":"sprites-ds","d":[3,73,116],"m":[-2,56,80],"flip":-1,"duration":23.3,"delay":-4.02,"dx":16,"dy":11},{"name":"wump","kind":"sprites-ds","d":[83,77,128],"m":[77,59,98],"flip":1,"duration":25.0,"delay":-4.69,"dx":-21,"dy":-14},{"name":"twemp","kind":"sprites-ds","d":[21,7,62],"m":[-1,75,86],"flip":1,"duration":13.8,"delay":-5.36,"dx":6,"dy":-17},{"name":"florantula","kind":"sprites-ds","d":[37,3,85],"m":[81,78,86],"flip":-1,"duration":15.5,"delay":-6.03,"dx":-11,"dy":20},{"name":"cowfin","kind":"sprites-ds","d":[57,10,75],"m":[17,5,51],"flip":1,"duration":17.2,"delay":-6.7,"dx":16,"dy":-8},{"name":"mooceon","kind":"sprites-ds","d":[72,6,105],"m":[59,7,59],"flip":-1,"duration":18.9,"delay":-7.37,"dx":-21,"dy":-11},{"name":"freezrick","kind":"sprites-ds","d":[23,89,95],"m":[5,34,49],"flip":1,"duration":20.6,"delay":-8.04,"dx":6,"dy":14},{"name":"rainbro","kind":"sprites-ds","d":[40,84,109],"m":[48,35,51],"flip":1,"duration":22.4,"delay":-8.71,"dx":-11,"dy":-17},{"name":"stonma","kind":"sprites-ds","d":[57,87,80],"m":[14,67,62],"flip":-1,"duration":24.1,"delay":-9.38,"dx":16,"dy":-20},{"name":"fleuroom","kind":"sprites-ds","d":[70,78,109],"m":[56,69,56],"flip":1,"duration":25.8,"delay":-10.05,"dx":-21,"dy":8},{"name":"torchbat","kind":"sprites","d":[7,17,79],"m":[20,90,66],"flip":-1,"duration":14.5,"delay":-10.72,"dx":6,"dy":-11},{"name":"leafing","kind":"sprites-ds","d":[92,64,103],"m":[65,91,76],"flip":1,"duration":16.2,"delay":-11.39,"dx":-11,"dy":-14},{"name":"waffy","kind":"sprites-ds","d":[31,65,65],"m":[1,84,54],"flip":1,"duration":18.0,"delay":-12.06,"dx":16,"dy":17},{"name":"erobi","kind":"sprites-ds","d":[72,41,81],"m":[86,7,55],"flip":-1,"duration":19.7,"delay":-12.73,"dx":-21,"dy":-20},{"name":"bolthook","kind":"sprites-ds","d":[47,29,61],"m":[32,51,59],"flip":1,"duration":21.4,"delay":-13.4,"dx":6,"dy":-8},{"name":"harpie","kind":"sprites-ds","d":[13,58,71],"m":[66,51,54],"flip":-1,"duration":23.1,"delay":-14.07,"dx":-11,"dy":11},{"name":"pipwi","kind":"sprites-ds","d":[62,60,99],"m":[4,4,44],"flip":1,"duration":24.8,"delay":-14.74,"dx":16,"dy":-14},{"name":"icy-freeze","kind":"sprites-ds","d":[95,10,83],"m":[84,67,58],"flip":1,"duration":13.6,"delay":-15.41,"dx":-21,"dy":-17}];
  const mq = window.matchMedia('(max-width: 750px)');
  const makeImage = (sprite, index) => {
    const image = document.createElement('img');
    const pos = mq.matches ? sprite.m : sprite.d;
    const path = sprite.kind + '/' + sprite.name + '/front.png';
    image.className = 'sigma-dex-float';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.dataset.species = sprite.name;
    image.loading = 'eager';
    image.decoding = 'async';
    image.style.left = pos[0] + 'vw';
    image.style.top = pos[1] + 'vh';
    image.style.width = pos[2] + 'px';
    image.style.setProperty('--flips', sprite.flip);
    image.style.setProperty('--dur', sprite.duration + 's');
    image.style.setProperty('--delay', sprite.delay + 's');
    image.style.setProperty('--dx', sprite.dx + 'px');
    image.style.setProperty('--dy', sprite.dy + 'px');
    let fallback = false;
    image.addEventListener('error', () => {
      if (!fallback) {
        fallback = true;
        image.src = FALLBACK_ROOT + path;
      } else {
        image.remove(); // Never show a broken-image placeholder.
      }
    });
    image.src = SOURCE_ROOT + path;
    return image;
  };
  let images = sprites.map(makeImage);
  field.replaceChildren(...images);
  // Reposition on crossing the mobile breakpoint, not on every resize frame.
  mq.addEventListener('change', () => {
    images.forEach((img, index) => {
      const sprite = sprites[index];
      const pos = mq.matches ? sprite.m : sprite.d;
      img.style.left = pos[0] + 'vw';
      img.style.top = pos[1] + 'vh';
      img.style.width = pos[2] + 'px';
    });
  });
})();
