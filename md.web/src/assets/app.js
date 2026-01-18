// ========================================
// LAYOUT INJECTION & NAVIGATION LOGIC
// ========================================

const NAV_STRUCTURE = [
  {
    section: 'Kontrol',
    items: [
      { icon: '📊', text: 'Kontrol Paneli', path: '/dashboard' }
    ]
  },
  {
    section: 'Operasyon',
    items: [
      {
        icon: '💼',
        text: 'İşler',
        path: '/isler',
        collapsible: true,
        children: [
          { text: 'İş Listesi', path: '/isler/list' },
          { text: 'Yeni İş Başlat', path: '/isler/yeni' },
          { text: 'Keşif/Ölçü Takvimi', path: '/isler/takvim' },
          { text: 'Üretim Planı', path: '/isler/uretim-plani' },
          { text: 'Montaj/Sevkiyat', path: '/isler/montaj-sevkiyat' }
        ]
      },
      { icon: '✓', text: 'Görevler', path: '/gorevler' },
      { icon: '👥', text: 'Müşteriler', path: '/musteriler' },
      { icon: '📅', text: 'Planlama/Takvim', path: '/planlama' }
    ]
  },
  {
    section: 'Malzeme & Tedarik',
    items: [
      {
        icon: '📦',
        text: 'Stok',
        path: '/stok',
        collapsible: true,
        children: [
          { text: 'Stok Listesi', path: '/stok/liste' },
          { text: 'Stok Hareketleri', path: '/stok/hareketler' },
          { text: 'Kritik Stok', path: '/stok/kritik' },
          { text: 'Rezervasyonlar', path: '/stok/rezervasyonlar' }
        ]
      },
      {
        icon: '🛒',
        text: 'Satınalma',
        path: '/satinalma',
        collapsible: true,
        children: [
          { text: 'Siparişler (PO)', path: '/satinalma/siparisler' },
          { text: 'Tedarikçiler', path: '/satinalma/tedarikciler' },
          { text: 'Malzeme Talepleri', path: '/satinalma/talepler' }
        ]
      }
    ]
  },
  {
    section: 'Finans & Evrak',
    items: [
      { icon: '📄', text: 'İrsaliye & Fatura', path: '/evrak/irsaliye-fatura' },
      { icon: '💰', text: 'Ödemeler/Kasa', path: '/finans/odemeler-kasa' }
    ]
  },
  {
    section: 'Dijital Arşiv & Rapor',
    items: [
      { icon: '📁', text: 'Dijital Arşiv', path: '/arsiv' },
      { icon: '📈', text: 'Raporlar', path: '/raporlar' }
    ]
  },
  {
    section: 'Sistem',
    items: [
      { icon: '⚙️', text: 'Ayarlar', path: '/ayarlar' }
    ]
  }
];

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  injectLayout();
  initializeNavigation();
});

// Inject sidebar and topbar into the page
function injectLayout() {
  const app = document.getElementById('app');
  if (!app) return;

  const sidebarHTML = createSidebar();
  const mainContentHTML = createMainContent();

  app.innerHTML = sidebarHTML + mainContentHTML;
}

// Create sidebar HTML
function createSidebar() {
  // Normalize pathname: remove trailing slash for comparison
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

  let navHTML = '';
  
  NAV_STRUCTURE.forEach(section => {
    navHTML += `
      <div class="nav-section">
        <div class="nav-section-title">${section.section}</div>
    `;

    section.items.forEach(item => {
      if (item.collapsible) {
        const hasActiveChild = item.children.some(child => currentPath.startsWith(child.path));
        const isParentActive = currentPath === item.path;
        const shouldBeOpen = hasActiveChild || isParentActive;
        const detailsId = `nav-${item.path.replace(/\//g, '-')}`;
        
        navHTML += `
          <details class="nav-collapsible" id="${detailsId}" ${shouldBeOpen ? 'open' : ''}>
            <summary>
              <div class="nav-collapsible-trigger ${isParentActive ? 'active' : ''}">
                <span class="nav-collapsible-icon">${item.icon}</span>
                <span class="nav-collapsible-text">${item.text}</span>
                <span class="nav-collapsible-arrow">▸</span>
              </div>
            </summary>
            <div class="nav-collapsible-content">
        `;

        item.children.forEach(child => {
          const isActive = currentPath === child.path;
          navHTML += `
            <div class="nav-item">
              <a href="${child.path}" class="nav-link ${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
                <span class="nav-link-icon">•</span>
                <span class="nav-link-text">${child.text}</span>
              </a>
            </div>
          `;
        });

        navHTML += `
            </div>
          </details>
        `;
      } else {
        const isActive = currentPath === item.path;
        navHTML += `
          <div class="nav-item">
            <a href="${item.path}" class="nav-link ${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
              <span class="nav-link-icon">${item.icon}</span>
              <span class="nav-link-text">${item.text}</span>
            </a>
          </div>
        `;
      }
    });

    navHTML += `</div>`;
  });

  return `
    <aside class="sidebar ${isSidebarCollapsed ? 'collapsed' : ''}" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">İT</div>
          <div class="sidebar-logo-text">İş Takip Paneli</div>
        </div>
        <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar">
          ☰
        </button>
      </div>
      <nav class="sidebar-nav">
        ${navHTML}
      </nav>
    </aside>
  `;
}

// Create main content area with topbar
function createMainContent() {
  return `
    <div class="main-content">
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="topbar-title" id="pageTitle">İş Takip Paneli</h1>
        </div>
        <div class="topbar-right">
          <div class="topbar-search">
            <span class="topbar-search-icon">🔍</span>
            <input type="search" placeholder="Ara..." />
          </div>
          <button class="topbar-user">
            <div class="topbar-user-avatar">BA</div>
            <div class="topbar-user-info">
              <div class="topbar-user-name">Batuhan</div>
              <div class="topbar-user-role">Yönetici</div>
            </div>
          </button>
        </div>
      </header>
      <main class="page-content" id="pageContent">
        <!-- Page content will be here -->
      </main>
    </div>
  `;
}

// Initialize navigation functionality
function initializeNavigation() {
  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('sidebarCollapsed', isCollapsed);
    });
  }

  // Persist collapsible state
  const collapsibles = document.querySelectorAll('.nav-collapsible');
  collapsibles.forEach(details => {
    const detailsId = details.id;
    
    // Load saved state from localStorage
    const savedState = localStorage.getItem(detailsId);
    if (savedState !== null) {
      details.open = savedState === 'true';
    }

    // Save state on toggle, but only if not forced open by active child
    details.addEventListener('toggle', () => {
      const currentPath = window.location.pathname;
      const detailsElement = details;
      
      // Check if this details has an active child
      const hasActiveChild = Array.from(detailsElement.querySelectorAll('.nav-link.active')).length > 0;
      
      // Only save to localStorage if no active child (user is manually toggling)
      if (!hasActiveChild) {
        localStorage.setItem(detailsId, details.open);
      }
    });
  });

  // Update page title based on current route
  updatePageTitle();
}

// Update page title in topbar based on current path
function updatePageTitle() {
  // Normalize pathname: remove trailing slash for comparison
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  const pageTitle = document.getElementById('pageTitle');
  
  if (!pageTitle) return;

  let title = 'İş Takip Paneli';

  // Find the matching nav item
  NAV_STRUCTURE.forEach(section => {
    section.items.forEach(item => {
      if (item.path === currentPath) {
        title = item.text;
      } else if (item.children) {
        item.children.forEach(child => {
          if (child.path === currentPath) {
            title = child.text;
          }
        });
      }
    });
  });

  pageTitle.textContent = title;
}

// Utility function to get page title for a given path
function getPageTitle(path) {
  let title = 'İş Takip Paneli';

  NAV_STRUCTURE.forEach(section => {
    section.items.forEach(item => {
      if (item.path === path) {
        title = item.text;
      } else if (item.children) {
        item.children.forEach(child => {
          if (child.path === path) {
            title = child.text;
          }
        });
      }
    });
  });

  return title;
}

// Export for use in page scripts
window.AppLayout = {
  getPageTitle,
  updatePageTitle
};

