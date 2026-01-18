export const NAV_ITEMS = [
  {
    section: 'Kontrol',
    items: [{ icon: '📊', label: 'Kontrol Paneli', path: '/dashboard' }],
  },
  {
    section: 'Operasyon',
    items: [
      {
        icon: '💼',
        label: 'İşler',
        path: '/isler',
        collapsible: true,
        children: [
          { label: 'İş Listesi', path: '/isler/list' },
          { label: 'Keşif/Ölçü Takvimi', path: '/isler/takvim' },
          { label: 'Üretim Planı', path: '/isler/uretim-plani' },
          { label: 'Montaj/Sevkiyat', path: '/isler/montaj-sevkiyat' },
          { 
            label: 'Üretim Takip', 
            path: '/isler/uretim-takip',
            icon: '🏭',
            children: [
              { label: 'Tüm Siparişler', path: '/isler/uretim-takip/siparisler' },
              { label: 'İç Üretim', path: '/isler/uretim-takip/ic-uretim' },
              { label: 'Dış Siparişler', path: '/isler/uretim-takip/dis-siparis' },
              { label: 'Cam Siparişleri', path: '/isler/uretim-takip/cam' },
              { label: 'Sorun Takip', path: '/isler/uretim-takip/sorunlar' },
            ]
          },
        ],
      },
      {
        icon: '✓',
        label: 'Görevler',
        path: '/gorevler',
        collapsible: true,
        children: [
          { label: 'Görev Listesi', path: '/gorevler/list' },
          { label: 'Personel', path: '/gorevler/personel' },
          { label: 'Ekipler', path: '/gorevler/ekipler' },
          { label: 'Roller', path: '/gorevler/roller' },
        ],
      },
      { icon: '👥', label: 'Müşteriler', path: '/musteriler' },
      { icon: '📅', label: 'Planlama/Takvim', path: '/planlama' },
    ],
  },
  {
    section: 'Stok & Satınalma',
    items: [
      {
        icon: '📦',
        label: 'Stok',
        path: '/stok',
        collapsible: true,
        children: [
          { label: 'Stok Listesi', path: '/stok/liste' },
          { label: 'Stok Hareketleri', path: '/stok/hareketler' },
          { label: 'Kritik Stok', path: '/stok/kritik' },
          { label: 'Rezervasyonlar', path: '/stok/rezervasyonlar' },
          { label: 'Renkler', path: '/stok/renkler' },
        ],
      },
      {
        icon: '🛒',
        label: 'Satınalma',
        path: '/satinalma',
        collapsible: true,
        children: [
          { label: 'Siparişler (PO)', path: '/satinalma/siparisler' },
          { label: 'Eksik Ürünler', path: '/satinalma/eksik' },
          { label: 'Bekleyen Teslimatlar', path: '/satinalma/bekleyen' },
          { label: 'Tedarikçiler', path: '/satinalma/tedarikciler' },
        ],
      },
    ],
  },
  {
    section: 'Finans & Evrak',
    items: [
      { icon: '📄', label: 'İrsaliye & Fatura', path: '/evrak/irsaliye-fatura' },
      { icon: '💰', label: 'Ödemeler/Kasa', path: '/finans/odemeler-kasa' },
    ],
  },
  {
    section: 'Dijital Arşiv & Rapor',
    items: [
      { icon: '📁', label: 'Dijital Arşiv', path: '/arsiv' },
      { icon: '📈', label: 'Raporlar', path: '/raporlar' },
    ],
  },
  {
    section: 'Sistem',
    items: [{ icon: '⚙️', label: 'Ayarlar', path: '/ayarlar' }],
  },
];

export const normalizePath = (path) => {
  if (!path) return '/';
  const cleaned = path.replace(/\/+$/, '');
  return cleaned === '' ? '/' : cleaned;
};

export const findPageTitle = (pathname) => {
  const normalized = normalizePath(pathname);
  let title = 'İş Takip Paneli';

  NAV_ITEMS.forEach((section) => {
    section.items.forEach((item) => {
      if (normalizePath(item.path) === normalized) {
        title = item.label;
      }
      if (item.children) {
        item.children.forEach((child) => {
          if (normalizePath(child.path) === normalized) {
            title = child.label;
          }
          if (child.children) {
            child.children.forEach((grandchild) => {
              if (normalizePath(grandchild.path) === normalized) {
                title = grandchild.label;
              }
            });
          }
        });
      }
    });
  });

  return title;
};
