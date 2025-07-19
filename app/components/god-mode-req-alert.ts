import { el } from "@webtaku/el";

function showGodModeRequirementDialog() {
  const dialog = el('sl-dialog', {
    label: 'God Mode Required',
    open: true
  },
    el('p', 'You do not meet the God Mode requirements. Please acquire a Gods NFT or at least 10,000 $GAIA tokens.'),
    el('div', { slot: 'footer', style: { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' } },
      el('a', {
        href: 'https://opensea.io/collection/gaia-protocol-gods', target: '_blank'
      },
        el('sl-button', { variant: 'primary' }, 'Buy NFT')
      ),
      el('a', {
        href: 'https://uniswap.org', target: '_blank'
      },
        el('sl-button', { variant: 'primary' }, 'Buy $GAIA')
      )
    )
  );

  document.body.appendChild(dialog);

  dialog.addEventListener('sl-after-hide', () => dialog.remove());
}

export { showGodModeRequirementDialog };
