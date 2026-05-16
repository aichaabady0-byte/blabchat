/**
 * BlabChat — Mobile UI Bootstrap
 * mobile-ui.js
 *
 * Drop this AFTER app.js in your HTML:
 *   <script type="module" src="mobile-ui.js"></script>
 *
 * Requires: your existing BlabChat globals (state, db, etc.)
 * Works with: mobile.css
 */

/* ─────────────────────────────────────────────────
   ONLY activate on screens ≤ 600 px
───────────────────────────────────────────────── */
function isMobile() { return window.innerWidth <= 600; }

/* ─────────────────────────────────────────────────
   PANEL MANAGER
  Creates, opens, and closes slide-up bottom panels.
───────────────────────────────────────────────── */
const panels = {};

function createPanel(id, titleHtml, bodyHtml, footerHtml = '') {
  if (document.getElementById(id)) return; // already exists

  const overlay = document.createElement('div');
  overlay.className = 'mob-panel-overlay';
  overlay.id = id;
  overlay.innerHTML = `
    <div class="mob-panel-backdrop"></div>
    <div class="mob-panel">
      <div class="mob-panel-handle"></div>
      <div class="mob-panel-header">
        <div class="mob-panel-title">${titleHtml}</div>
        <button class="mob-panel-close" aria-label="Fermer">
          <i class="fi fi-rr-cross-small"></i>
        </button>
      </div>
      <div class="mob-panel-body" id="${id}-body">
        ${bodyHtml}
      </div>
      ${footerHtml ? `<div class="mob-panel-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);

  // Close on backdrop / close btn
  overlay.querySelector('.mob-panel-backdrop').addEventListener('click', () => closePanel(id));
  overlay.querySelector('.mob-panel-close').addEventListener('click', () => closePanel(id));

  // Swipe down to close
  let startY = 0;
  const panel = overlay.querySelector('.mob-panel');
  panel.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  panel.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientY - startY > 80) closePanel(id);
  }, { passive: true });

  panels[id] = overlay;
}

function openPanel(id) {
  const el = panels[id];
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePanel(id) {
  const el = panels[id];
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
}

/* ─────────────────────────────────────────────────
   BOTTOM NAV
───────────────────────────────────────────────── */
function buildBottomNav() {
  if (document.getElementById('mob-bottom-nav')) return;

  const nav = document.createElement('nav');
  nav.id = 'mob-bottom-nav';
  nav.className = 'mobile-bottom-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Navigation principale');
  nav.innerHTML = `
    <button class="mob-nav-item" id="mob-nav-chat" aria-label="Chat" title="Chat">
      <span class="mob-nav-icon"><i class="fi fi-rr-home"></i></span>
      <span>Accueil</span>
      <span class="mob-nav-dot" id="mob-dot-chat"></span>
    </button>

    <button class="mob-nav-item" id="mob-nav-servers" aria-label="Serveurs" title="Serveurs">
      <span class="mob-nav-icon"><i class="fi fi-rr-grid"></i></span>
      <span>Serveurs</span>
    </button>

    <button class="mob-nav-item bp-nav" id="mob-nav-shop" aria-label="BlabPoints Shop" title="Shop">
      <span class="mob-nav-icon"><i class="fi fi-rr-star"></i></span>
      <span>Shop</span>
    </button>

    <button class="mob-nav-item bplus-nav" id="mob-nav-bplus" aria-label="Blab+" title="Blab+">
      <span class="mob-bplus-pill">Blab+</span>
      <span>Blab+</span>
    </button>

    <button class="mob-nav-item" id="mob-nav-news" aria-label="What's New" title="What's New">
      <span class="mob-nav-icon"><i class="fi fi-rr-sparkles"></i></span>
      <span>Nouveau</span>
      <span class="mob-nav-dot" id="mob-dot-news"></span>
    </button>
  `;
  document.body.appendChild(nav);

  /* FAB: open channels panel */
  const fab = document.createElement('button');
  fab.id = 'mob-fab';
  fab.className = 'mob-fab';
  fab.setAttribute('aria-label', 'Salons');
  fab.title = 'Voir les salons';
  fab.innerHTML = '<i class="fi fi-rr-hashtag"></i>';
  document.body.appendChild(fab);

  // Wire clicks
  document.getElementById('mob-nav-chat').addEventListener('click', () => {
    setActiveNav('mob-nav-chat');
    closePanel('mob-panel-channels');
    closePanel('mob-panel-servers');
  });
  fab.addEventListener('click', () => {
    openPanel('mob-panel-channels');
    refreshChannelsPanel();
  });
  document.getElementById('mob-nav-servers').addEventListener('click', () => {
    setActiveNav('mob-nav-servers');
    openPanel('mob-panel-servers');
    refreshServersPanel();
  });
  document.getElementById('mob-nav-shop').addEventListener('click', () => {
    setActiveNav('mob-nav-shop');
    openPanel('mob-panel-shop');
    refreshShopPanel();
  });
  document.getElementById('mob-nav-bplus').addEventListener('click', () => {
    setActiveNav('mob-nav-bplus');
    openPanel('mob-panel-bplus');
    refreshBlabPlusPanel();
  });
  document.getElementById('mob-nav-news').addEventListener('click', () => {
    setActiveNav('mob-nav-news');
    openPanel('mob-panel-news');
    refreshNewsPanel();
    // Clear unread dot
    document.getElementById('mob-dot-news')?.classList.remove('visible');
  });
}

function setActiveNav(id) {
  document.querySelectorAll('.mob-nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

/* ─────────────────────────────────────────────────
   CHANNELS PANEL
───────────────────────────────────────────────── */
function buildChannelsPanel() {
  createPanel('mob-panel-channels',
    '<i class="fi fi-rr-hashtag"></i> Salons',
    '<div class="mob-ch-loading" style="color:var(--txt-3);text-align:center;padding:20px">Chargement…</div>',
  );

  // Append user bar at bottom of panel
  const panel = document.querySelector('#mob-panel-channels .mob-panel');
  const bar = document.createElement('div');
  bar.className = 'mob-panel-user-bar';
  bar.id = 'mob-user-bar';
  bar.innerHTML = `
    <div class="mob-user-avatar" id="mob-ub-avatar">?</div>
    <div class="mob-user-info">
      <div class="mob-user-name" id="mob-ub-name">…</div>
      <div class="mob-user-status">En ligne</div>
    </div>
    <div class="mob-user-bp" id="mob-ub-bp"><i class="fi fi-rr-star"></i> 0</div>
    <button style="background:none;border:none;color:var(--txt-3);cursor:pointer;font-size:1rem;padding:4px" onclick="logout?.()">
      <i class="fi fi-rr-sign-out-alt"></i>
    </button>
  `;
  panel.appendChild(bar);
}

function refreshChannelsPanel() {
  const body = document.getElementById('mob-panel-channels-body');
  if (!body) return;

  // Try to mirror state from the main app
  // Works with the global `state` object from app.js
  const state = window.state;
  if (!state) { body.innerHTML = '<div class="mob-ch-loading" style="color:var(--txt-3);text-align:center;padding:20px">Lance l\'app d\'abord !</div>'; return; }

  let html = '';
  const server = state.currentServer;

  // Title update
  const titleEl = document.querySelector('#mob-panel-channels .mob-panel-title');
  if (titleEl) titleEl.innerHTML = `<i class="fi fi-rr-hashtag"></i> ${server ? server.name : 'GLOBAL'}`;

  if (!server) {
    html = '<div style="color:var(--txt-3);text-align:center;padding:20px;font-size:.88rem">Choisis un serveur d\'abord</div>';
  } else {
    const cats = server.categories || [{ name: 'Général', channels: server.channels || [] }];
    cats.forEach(cat => {
      html += `<div class="mob-ch-category">${cat.name || cat}</div>`;
      const channels = Array.isArray(cat) ? cat : (cat.channels || []);
      channels.forEach(ch => {
        const name = typeof ch === 'string' ? ch : ch.name;
        const active = name === state.currentChannel ? ' active' : '';
        html += `<div class="mob-ch-item${active}" onclick="mobSelectChannel('${name}')">
          <span class="mob-ch-hash"><i class="fi fi-rr-hashtag"></i></span>
          ${name}
        </div>`;
      });
    });
    if (!html) html = '<div style="color:var(--txt-3);text-align:center;padding:20px;font-size:.88rem">Aucun salon</div>';
  }

  body.innerHTML = html;

  // User bar
  const me = state.me;
  if (me) {
    const av = document.getElementById('mob-ub-avatar');
    const nm = document.getElementById('mob-ub-name');
    const bp = document.getElementById('mob-ub-bp');
    if (av) { av.textContent = (me.username || me.pseudo || '?')[0].toUpperCase(); }
    if (nm) { nm.textContent = me.username || me.pseudo || '…'; }
    if (bp) { bp.innerHTML = `<i class="fi fi-rr-star"></i> ${me.blabpoints ?? 0}`; }
  }
}

window.mobSelectChannel = function(channelName) {
  // Call the global app functions if available
  if (window.selectChannel) window.selectChannel(channelName);
  // Also update URL hash or however app.js does it
  closePanel('mob-panel-channels');
  setActiveNav('mob-nav-chat');
};

/* ─────────────────────────────────────────────────
   SERVERS PANEL
───────────────────────────────────────────────── */
function buildServersPanel() {
  createPanel('mob-panel-servers',
    '<i class="fi fi-rr-grid"></i> Mes serveurs',
    '<div style="color:var(--txt-3);text-align:center;padding:20px">Chargement…</div>',
  );
}

function refreshServersPanel() {
  const body = document.getElementById('mob-panel-servers-body');
  if (!body) return;
  const state = window.state;
  if (!state) { body.innerHTML = '<div style="color:var(--txt-3);text-align:center;padding:20px">Lance l\'app d\'abord</div>'; return; }

  const servers = state.servers || [];
  let html = '';

  servers.forEach(sv => {
    const active = (state.currentServer?.id === sv.id || state.currentServer?.name === sv.name) ? ' active' : '';
    const initial = (sv.name || '?')[0].toUpperCase();
    html += `<div class="mob-server-card${active}" onclick="mobSelectServer('${sv.id || sv.name}')">
      <div class="mob-server-icon" style="background:${sv.color || 'var(--accent)'}">
        ${sv.emoji || initial}
      </div>
      <div class="mob-server-info">
        <div class="mob-server-name">${sv.name}</div>
        <div class="mob-server-meta">${sv.memberCount || sv.members?.length || 1} membre${(sv.memberCount || sv.members?.length || 1) > 1 ? 's' : ''}</div>
      </div>
      <i class="fi fi-rr-angle-right" style="color:var(--txt-3)"></i>
    </div>`;
  });

  html += `<button class="mob-server-add-btn" onclick="createNewServer?.(); closePanel('mob-panel-servers')">
    <i class="fi fi-rr-plus"></i> Créer un serveur
  </button>`;

  body.innerHTML = html;
}

window.mobSelectServer = function(serverId) {
  if (window.selectServer) window.selectServer(serverId);
  else if (window.switchToServer) window.switchToServer(serverId);
  closePanel('mob-panel-servers');
  openPanel('mob-panel-channels');
  setTimeout(() => refreshChannelsPanel(), 150);
};

/* ─────────────────────────────────────────────────
   SHOP PANEL (BlabPoints)
───────────────────────────────────────────────── */
const SHOP_TABS = [
  { id: 'cosmetics', label: '🎨 Couleurs' },
  { id: 'fonts',     label: '✏️ Polices' },
  { id: 'anims',     label: '✨ Animations' },
];

const SHOP_ITEMS = {
  cosmetics: [
    { id: 'color-blue',   name: 'Bleu Accent',  desc: 'Pseudo en bleu accent',   price: 5,  icon: '🔵', color: '#5b6af0' },
    { id: 'color-green',  name: 'Vert Néon',    desc: 'Pseudo en vert vif',       price: 5,  icon: '🟢', color: '#3fd68f' },
    { id: 'color-red',    name: 'Rouge Feu',    desc: 'Pseudo en rouge',          price: 5,  icon: '🔴', color: '#f05b5b' },
    { id: 'color-gold',   name: 'Or Premium',   desc: 'Pseudo doré',             price: 10, icon: '⭐', color: '#f5c842' },
    { id: 'color-pink',   name: 'Rose Choc',    desc: 'Pseudo rose vif',          price: 8,  icon: '🌸', color: '#e05bf0' },
    { id: 'color-cyan',   name: 'Cyan Frost',   desc: 'Pseudo cyan',             price: 8,  icon: '💠', color: '#5bf0e0' },
  ],
  fonts: [
    { id: 'font-mono',  name: 'Mono',       desc: 'Police monospace', price: 8,  icon: '⌨️', font: 'mono' },
    { id: 'font-syne',  name: 'Syne Bold',  desc: 'Police Syne 800',  price: 8,  icon: '𝗦', font: 'syne' },
    { id: 'font-serif', name: 'Serif Élégant', desc: 'Georgia italic', price: 8, icon: '𝐴', font: 'serif' },
  ],
  anims: [
    { id: 'anim-rainbow', name: 'Arc-en-ciel', desc: 'Couleurs qui défilent', price: 20, icon: '🌈', anim: 'rainbow' },
    { id: 'anim-glow',    name: 'Lueur',       desc: 'Halo lumineux pulsant', price: 15, icon: '💫', anim: 'glow' },
    { id: 'anim-pulse',   name: 'Pulsation',   desc: 'Apparition / disparition', price: 12, icon: '🫀', anim: 'pulse' },
  ],
};

let currentShopTab = 'cosmetics';

function buildShopPanel() {
  const tabsHtml = SHOP_TABS.map(t =>
    `<button class="mob-shop-tab${t.id === currentShopTab ? ' active' : ''}" data-tab="${t.id}" onclick="mobShopTab('${t.id}')">${t.label}</button>`
  ).join('');

  createPanel('mob-panel-shop',
    '<i class="fi fi-rr-star" style="color:var(--bp-gold)"></i> <span style="color:var(--bp-gold)">BlabPoints</span>',
    `
    <div class="mob-bp-hero">
      <div class="mob-bp-hero-icon"><i class="fi fi-rr-star"></i></div>
      <div class="mob-bp-hero-info">
        <h3>Ton solde</h3>
        <p>Gagne 5 BP/jour · dépense en style</p>
      </div>
      <div class="mob-bp-balance" id="mob-shop-balance">0<span>BP</span></div>
    </div>

    <div class="mob-daily-strip" id="mob-daily-strip">
      <span class="daily-icon"><i class="fi fi-rr-gift"></i></span>
      <div class="mob-daily-info">
        <strong id="mob-daily-label">Récompense dispo !</strong>
        <p id="mob-daily-sub">Récupère tes 5 BP du jour</p>
      </div>
      <button class="btn-bp" id="mob-daily-btn" onclick="mobClaimDaily()">+5</button>
    </div>

    <div class="mob-name-preview" id="mob-shop-preview">
      <span class="mob-name-preview-label">Aperçu</span>
      <span class="mob-name-preview-val" id="mob-preview-name">Pseudo</span>
    </div>

    <div class="mob-shop-tabs" id="mob-shop-tabs">${tabsHtml}</div>
    <div class="mob-shop-grid" id="mob-shop-grid"></div>
    `,
  );
}

window.mobShopTab = function(tabId) {
  currentShopTab = tabId;
  document.querySelectorAll('.mob-shop-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tabId));
  renderShopGrid();
};

function renderShopGrid() {
  const grid = document.getElementById('mob-shop-grid');
  if (!grid) return;
  const state = window.state;
  const me = state?.me || {};
  const owned = me.ownedItems || [];
  const bplus = me.blabplus || false;
  const items = SHOP_ITEMS[currentShopTab] || [];

  grid.innerHTML = items.map(item => {
    const isOwned = owned.includes(item.id);
    const price = bplus ? Math.ceil(item.price * 0.8) : item.price;
    const canAfford = (me.blabpoints ?? 0) >= price;

    // Preview style
    let previewStyle = '';
    if (item.color) previewStyle = `color:${item.color}`;
    if (item.font === 'mono') previewStyle = 'font-family:monospace;letter-spacing:2px';
    if (item.font === 'syne') previewStyle = "font-family:'Syne',sans-serif;font-weight:800";
    if (item.font === 'serif') previewStyle = 'font-family:Georgia,serif;font-style:italic';

    return `
      <div class="mob-shop-item${isOwned ? ' owned' : ''}" onclick="mobShopPreview('${item.id}','${item.color||''}','${item.font||''}','${item.anim||''}')">
        <div class="mob-shop-item-icon">${item.icon}</div>
        <div class="mob-shop-item-name">${item.name}</div>
        <div class="mob-shop-item-desc">${item.desc}</div>
        <div class="mob-shop-item-price"><i class="fi fi-rr-star"></i> ${price} BP${bplus && item.price !== price ? ' <span style="color:var(--txt-3);font-weight:400;font-size:.7rem">−20%</span>' : ''}</div>
        ${isOwned
          ? `<button class="mob-shop-item-buy" onclick="mobApplySkin('${item.id}','${item.color||''}','${item.font||''}','${item.anim||''}');event.stopPropagation()">Appliquer</button>`
          : `<button class="mob-shop-item-buy" ${canAfford ? '' : 'disabled'} onclick="mobBuySkin('${item.id}',${price},'${item.color||''}','${item.font||''}','${item.anim||''}');event.stopPropagation()">${canAfford ? 'Acheter' : 'Pas assez'}</button>`
        }
      </div>`;
  }).join('');
}

window.mobShopPreview = function(id, color, font, anim) {
  const el = document.getElementById('mob-preview-name');
  if (!el) return;
  const name = window.state?.me?.username || window.state?.me?.pseudo || 'Pseudo';
  el.textContent = name;
  el.style.cssText = '';
  if (color) el.style.color = color;
  if (font === 'mono') { el.style.fontFamily = 'monospace'; el.style.letterSpacing = '2px'; }
  if (font === 'syne') { el.style.fontFamily = "'Syne',sans-serif"; el.style.fontWeight = '800'; }
  if (font === 'serif') { el.style.fontFamily = 'Georgia,serif'; el.style.fontStyle = 'italic'; }
  el.style.animation = '';
  if (anim === 'rainbow') el.style.animation = 'nameRainbow 3s linear infinite';
  if (anim === 'glow')    el.style.animation = 'nameGlow 2s ease-in-out infinite';
  if (anim === 'pulse')   el.style.animation = 'namePulse 2s ease-in-out infinite';
};

window.mobBuySkin = function(id, price, color, font, anim) {
  // Delegates to the existing global buyShopItem if it exists
  if (window.buyShopItem) { window.buyShopItem(id, price); refreshShopPanel(); return; }
  // Minimal fallback
  const me = window.state?.me;
  if (!me) return;
  if ((me.blabpoints ?? 0) < price) { showMobToast('Pas assez de BlabPoints !', 'error'); return; }
  me.blabpoints -= price;
  me.ownedItems = me.ownedItems || [];
  me.ownedItems.push(id);
  showMobToast(`Acheté : ${id} !`, 'success');
  refreshShopPanel();
};

window.mobApplySkin = function(id, color, font, anim) {
  if (window.applyShopItem) { window.applyShopItem(id); return; }
  const me = window.state?.me;
  if (!me) return;
  if (color) me.nameColor = color;
  if (font)  me.nameFont  = font;
  if (anim)  me.nameAnim  = anim;
  showMobToast('Skin appliqué !', 'success');
  mobShopPreview(id, color, font, anim);
};

window.mobClaimDaily = function() {
  if (window.claimDailyBP) { window.claimDailyBP(); refreshShopPanel(); return; }
  const me = window.state?.me;
  if (!me) return;
  me.blabpoints = (me.blabpoints ?? 0) + 5;
  showMobToast('+5 BlabPoints récupérés !', 'success');
  refreshShopPanel();
};

function refreshShopPanel() {
  const me = window.state?.me || {};
  const bal = document.getElementById('mob-shop-balance');
  if (bal) bal.innerHTML = `${me.blabpoints ?? 0}<span>BP</span>`;
  const prevName = document.getElementById('mob-preview-name');
  if (prevName) prevName.textContent = me.username || me.pseudo || 'Pseudo';
  renderShopGrid();
}

/* ─────────────────────────────────────────────────
   BLAB+ PANEL
───────────────────────────────────────────────── */
function buildBlabPlusPanel() {
  createPanel('mob-panel-bplus',
    '<span class="blabplus-badge" style="font-size:.85rem;padding:3px 10px;border-radius:10px">Blab+</span>',
    '<div style="color:var(--txt-3);text-align:center;padding:20px">Chargement…</div>',
  );
}

function refreshBlabPlusPanel() {
  const body = document.getElementById('mob-panel-bplus-body');
  if (!body) return;
  const me = window.state?.me || {};
  const subscribed = me.blabplus || false;

  if (subscribed) {
    body.innerHTML = `
      <div class="mob-bplus-subscribed-badge">
        <i class="fi fi-rr-check-circle" style="font-size:1.5rem"></i>
        <div>
          <div style="font-size:.95rem;font-weight:800">Tu es abonné Blab+ !</div>
          <div style="font-size:.75rem;color:#3a8a3a;margin-top:2px">Renouvellement auto chaque mois</div>
        </div>
      </div>
      <div style="font-size:.72rem;font-weight:700;letter-spacing:1.5px;color:#444;text-transform:uppercase">Ton skin gratuit du mois</div>
      <div class="mob-skin-grid">
        ${mobFreeSkins().map(s => `
          <div class="mob-skin-opt" onclick="mobClaimFreeSkin('${s.id}','${s.color||''}','${s.font||''}','${s.anim||''}')">
            <span class="skin-icon">${s.icon}</span>${s.name}
          </div>`).join('')}
      </div>
      <button class="mob-bplus-subscribe-btn" style="background:#1a1a1a;color:#444;font-size:.8rem" onclick="mobCancelBplus()">Annuler l'abonnement</button>
    `;
  } else {
    body.innerHTML = `
      <div class="mob-bplus-hero">
        <div class="mob-bplus-big-pill">Blab+</div>
        <div class="mob-bplus-tagline">Passe au niveau supérieur</div>
        <div class="mob-bplus-sub">100 BlabPoints/mois, un skin gratuit, −20% dans le shop et le badge exclusif.</div>
        <div class="mob-bplus-price">100 <small>BlabPoints par mois · automatiques</small></div>
      </div>
      <div class="mob-bplus-perks">
        ${[
          { icon: 'fi-rr-star',    title: '+100 BlabPoints / mois',       desc: 'Crédités automatiquement' },
          { icon: 'fi-rr-palette', title: '1 skin gratuit / mois',        desc: 'Couleur, police ou animation' },
          { icon: 'fi-rr-tag',     title: '−20% dans tout le shop',       desc: 'Réduction auto sur chaque achat' },
          { icon: 'fi-rr-id-badge',title: 'Badge Blab+ partout',          desc: 'Visible dans les messages & listes' },
        ].map(p => `
          <div class="mob-bplus-perk">
            <div class="mob-bplus-perk-icon"><i class="fi ${p.icon}"></i></div>
            <div class="mob-bplus-perk-text">
              <div class="mob-bplus-perk-title">${p.title}</div>
              <div class="mob-bplus-perk-desc">${p.desc}</div>
            </div>
          </div>`).join('')}
      </div>
      <button class="mob-bplus-subscribe-btn" onclick="mobSubscribeBplus()">
        S'abonner — 100 BP/mois <i class="fi fi-rr-arrow-right"></i>
      </button>
      <p style="text-align:center;font-size:.7rem;color:#333">Annulable à tout moment · Démo sans CB</p>
    `;
  }
}

function mobFreeSkins() {
  return [
    { id: 'free-rainbow', name: 'Arc-en-ciel', icon: '🌈', anim: 'rainbow' },
    { id: 'free-gold',    name: 'Or',           icon: '⭐', color: '#f5c842' },
    { id: 'free-glow',    name: 'Lueur',        icon: '💫', anim: 'glow' },
    { id: 'free-syne',    name: 'Syne Bold',    icon: '𝗦', font: 'syne' },
    { id: 'free-mono',    name: 'Mono',         icon: '⌨️', font: 'mono' },
    { id: 'free-pink',    name: 'Rose',         icon: '🌸', color: '#e05bf0' },
  ];
}

window.mobClaimFreeSkin = function(id, color, font, anim) {
  if (window.claimFreeSkin) { window.claimFreeSkin(id); return; }
  const me = window.state?.me;
  if (!me) return;
  if (color) me.nameColor = color;
  if (font)  me.nameFont  = font;
  if (anim)  me.nameAnim  = anim;
  me.ownedItems = me.ownedItems || [];
  if (!me.ownedItems.includes(id)) me.ownedItems.push(id);
  showMobToast('Skin gratuit appliqué ! ✨', 'success');
};

window.mobSubscribeBplus = function() {
  if (window.subscribeBlabPlus) { window.subscribeBlabPlus(); refreshBlabPlusPanel(); return; }
  const me = window.state?.me;
  if (!me) return;
  me.blabplus = true;
  me.blabpoints = (me.blabpoints ?? 0) + 100;
  showMobToast('Bienvenue dans Blab+ ! 🎉 +100 BP crédités', 'success');
  refreshBlabPlusPanel();
};

window.mobCancelBplus = function() {
  if (window.cancelBlabPlus) { window.cancelBlabPlus(); refreshBlabPlusPanel(); return; }
  const me = window.state?.me;
  if (!me) return;
  me.blabplus = false;
  showMobToast('Abonnement annulé.', 'info');
  refreshBlabPlusPanel();
};

/* ─────────────────────────────────────────────────
   WHAT'S NEW PANEL
───────────────────────────────────────────────── */
function buildNewsPanel() {
  createPanel('mob-panel-news',
    '<i class="fi fi-rr-sparkles"></i> What\'s New',
    '<div style="color:var(--txt-3);text-align:center;padding:20px">Chargement…</div>',
  );
}

function refreshNewsPanel() {
  const body = document.getElementById('mob-panel-news-body');
  if (!body) return;

  // Try global news list
  const news = window.state?.news || window.newsItems || [];

  if (!news.length) {
    body.innerHTML = `<div class="mob-news-empty">
      <div style="font-size:2.5rem;margin-bottom:10px">📭</div>
      Aucune annonce pour l'instant.<br>Revenez bientôt !
    </div>`;
    return;
  }

  body.innerHTML = news.map(n => `
    <div class="mob-news-card">
      ${n.imageUrl ? `<img class="mob-news-card-img" src="${n.imageUrl}" alt="" loading="lazy">` : ''}
      <div class="mob-news-card-body">
        <div class="mob-news-card-date">${n.date || ''}</div>
        <div class="mob-news-card-title">${n.title || 'Annonce'}</div>
        <div class="mob-news-card-desc">${n.desc || n.description || ''}</div>
      </div>
    </div>
  `).join('');
}

/* ─────────────────────────────────────────────────
   MOBILE TOAST NOTIFICATIONS
───────────────────────────────────────────────── */
function showMobToast(msg, type = 'info') {
  const colors = { success: 'var(--green)', error: 'var(--red)', info: 'var(--accent)' };
  const icons  = { success: 'fi-rr-check-circle', error: 'fi-rr-cross-circle', info: 'fi-rr-info' };

  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
    z-index:9999; background:var(--bg-card); border:1px solid ${colors[type]};
    border-radius:12px; padding:10px 16px; display:flex; align-items:center; gap:8px;
    font-size:.85rem; font-weight:600; color:var(--txt-1);
    box-shadow:0 8px 24px #00000060; max-width:90vw;
    animation:fadeUp .3s ease;
  `;
  toast.innerHTML = `<i class="fi ${icons[type]}" style="color:${colors[type]}"></i> ${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .4s'; setTimeout(() => toast.remove(), 400); }, 2800);
}

/* ─────────────────────────────────────────────────
   INIT — build everything on DOMContentLoaded
   and re-check on resize
───────────────────────────────────────────────── */
function initMobileUI() {
  if (!isMobile()) return;

  // Only build when on the app page
  const appPage = document.getElementById('page-app');
  if (!appPage) return;

  // Wait for app page to be active
  const observer = new MutationObserver(() => {
    if (appPage.classList.contains('active')) {
      observer.disconnect();
      _buildAll();
    }
  });

  if (appPage.classList.contains('active')) {
    _buildAll();
  } else {
    observer.observe(appPage, { attributes: true, attributeFilter: ['class'] });
  }
}

function _buildAll() {
  buildBottomNav();
  buildChannelsPanel();
  buildServersPanel();
  buildShopPanel();
  buildBlabPlusPanel();
  buildNewsPanel();

  // Mark news dot if there are unread news
  setTimeout(() => {
    const news = window.state?.news || window.newsItems || [];
    if (news.length) {
      document.getElementById('mob-dot-news')?.classList.add('visible');
    }
  }, 1000);

  // Set initial nav active state
  setActiveNav('mob-nav-chat');
}

// Expose globally so app.js can call after login
window.initMobileUI = initMobileUI;
window.refreshMobChannels = refreshChannelsPanel;
window.refreshMobShop = refreshShopPanel;
window.refreshMobNews = refreshNewsPanel;

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileUI);
} else {
  initMobileUI();
}

// Re-check on resize (tablet → mobile)
let lastMobile = isMobile();
window.addEventListener('resize', () => {
  const nowMobile = isMobile();
  if (nowMobile && !lastMobile) initMobileUI();
  lastMobile = nowMobile;
});
