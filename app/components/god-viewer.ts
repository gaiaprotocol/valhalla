import { getSelectedParts, GodMetadata } from '@gaiaprotocol/god-mode-shared';
import { el } from '@webtaku/el';
import { preload, SpineObject, World } from 'kiwiengine';

// Shoelace 스피너 유틸
function createShoelaceSpinner() {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(1px)',
    background: 'rgba(0,0,0,0.15)',
    zIndex: '10',
    borderRadius: '12px'
  });
  const spinner = document.createElement('sl-spinner');
  // spinner.style.fontSize = '24px'; // 필요하면 크기 조절
  wrap.appendChild(spinner);
  return wrap;
}

export function createGodViewer(metadata: GodMetadata) {
  // 컨테이너는 위치 기준이 필요합니다 (스피너 오버레이용)
  const container = el('.god-viewer') as HTMLDivElement;
  container.style.width = '100%';
  container.style.aspectRatio = '1';
  container.style.position = 'relative';
  container.style.borderRadius = '12px';
  container.style.overflow = 'hidden';

  const selectedParts = getSelectedParts(metadata);
  const skins: string[] = [];
  for (const [traitName, part] of Object.entries(selectedParts)) {
    skins.push(`${traitName}/${(part as any).name}`);
  }

  const typeLowerCase = metadata.type.toLowerCase();
  const genderLowerCase = metadata.gender.toLowerCase();
  const path = `/spine-files/god-${typeLowerCase}-${genderLowerCase}`;

  // ⬇️ Shoelace 스피너 사용
  const loading = createShoelaceSpinner();
  container.appendChild(loading);

  const world = new World({ width: 1024, height: 1024 });
  world.container.style.width = '100%';
  world.container.style.height = '100%';
  container.appendChild(world.container);

  const texture = metadata.type === 'Water'
    ? {
      [`water-${genderLowerCase}.png`]: `${path}.png`,
      [`water-${genderLowerCase}_2.png`]: `${path}-2.png`,
      [`water-${genderLowerCase}_3.png`]: `${path}-3.png`,
    }
    : `${path}.png`;

  preload([
    `${path}.json`,
    `${path}.atlas`,
    ...(typeof texture === 'string' ? [texture] : Object.values(texture))
  ]).then(() => {

    const spineObject = new SpineObject({
      json: `${path}.json`,
      atlas: `${path}.atlas`,
      texture,
      skins,
      animation: 'animation',
    });

    spineObject.on('load', () => loading.remove());
    spineObject.on('animationend', () => {
      if (spineObject) spineObject.animation = 'animation';
    });

    world.add(spineObject);

    container.style.cursor = 'pointer';
    container.addEventListener('click', () => {
      if (spineObject) spineObject.animation = 'touched';
    });
  });

  return container;
}
