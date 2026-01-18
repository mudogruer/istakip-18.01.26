import { useEffect, useState, useMemo } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import {
  getPurchaseOrdersFromAPI,
  getPurchaseOrder,
  createPurchaseOrder,
  addItemsToPurchaseOrder,
  sendPurchaseOrder,
  receivePurchaseDelivery,
  deletePurchaseOrder,
  getSuppliersFromAPI,
  getMissingItems,
  searchStockItems,
} from '../services/dataService';

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);
const formatCurrency = (value) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value || 0);

const STATUS_LABELS = {
  draft: { label: 'Taslak', tone: 'secondary', icon: '📝' },
  sent: { label: 'Gönderildi', tone: 'primary', icon: '📤' },
  partial: { label: 'Kısmi Teslim', tone: 'warning', icon: '📦' },
  delivered: { label: 'Tamamlandı', tone: 'success', icon: '✅' },
};

const defaultOrderForm = {
  supplierId: '',
  supplierName: '',
  notes: '',
  expectedDate: '',
  items: [],
};

const defaultItemForm = {
  productCode: '',
  colorCode: '',
  productName: '',
  quantity: 1,
  unit: 'boy',
  unitCost: 0,
};

const defaultDeliveryForm = {
  items: [],
  note: '',
  receivedBy: '',
};

const SatinalmaSiparisler = () => {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [missingItems, setMissingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  // Order form
  const [formOpen, setFormOpen] = useState(false);
  const [orderForm, setOrderForm] = useState(defaultOrderForm);
  const [itemForm, setItemForm] = useState(defaultItemForm);
  const [submitting, setSubmitting] = useState(false);

  // Order detail
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Delivery form
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState(defaultDeliveryForm);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);

  // Missing items modal
  const [missingOpen, setMissingOpen] = useState(false);
  const [selectedMissing, setSelectedMissing] = useState([]);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
      try {
        setLoading(true);
        setError('');
      const [ordersData, suppliersData, missingData] = await Promise.all([
        getPurchaseOrdersFromAPI(),
        getSuppliersFromAPI(),
        getMissingItems().catch(() => []),
      ]);
      setOrders(ordersData);
      setSuppliers(suppliersData);
      setMissingItems(missingData);
      } catch (err) {
      setError(err.message || 'Veriler alınamadı');
      } finally {
        setLoading(false);
      }
    };

  // Product search
  useEffect(() => {
    if (!productSearch || productSearch.length < 2) {
      setProductResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchStockItems(productSearch, '');
        setProductResults(results.slice(0, 10));
      } catch (err) {
        console.error('Product search error:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearch]);

  const filteredOrders = useMemo(() => {
    let data = [...orders];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          (o.supplierName || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      data = data.filter((o) => o.status === statusFilter);
    }

    if (supplierFilter !== 'all') {
      data = data.filter((o) => o.supplierId === supplierFilter);
    }

    return data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, search, statusFilter, supplierFilter]);

  const summary = useMemo(() => {
    const total = orders.length;
    const draft = orders.filter((o) => o.status === 'draft').length;
    const pending = orders.filter((o) => ['sent', 'partial'].includes(o.status)).length;
    const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return { total, draft, pending, totalAmount };
  }, [orders]);

  const openCreate = () => {
    setOrderForm(defaultOrderForm);
    setItemForm(defaultItemForm);
    setProductSearch('');
    setProductResults([]);
    setFormOpen(true);
  };

  const openFromMissing = () => {
    setSelectedMissing([]);
    setMissingOpen(true);
  };

  const selectProduct = (product) => {
    setItemForm({
      productCode: product.productCode,
      colorCode: product.colorCode,
      productName: `${product.name} ${product.colorName || ''}`.trim(),
      quantity: 1,
      unit: product.unit || 'boy',
      unitCost: product.unitCost || 0,
    });
    setProductSearch('');
    setProductResults([]);
  };

  const addItemToOrder = () => {
    if (!itemForm.productCode || itemForm.quantity <= 0) return;

    setOrderForm((prev) => {
      const existing = prev.items.find(
        (i) => i.productCode === itemForm.productCode && i.colorCode === itemForm.colorCode
      );
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.productCode === itemForm.productCode && i.colorCode === itemForm.colorCode
              ? { ...i, quantity: i.quantity + itemForm.quantity }
              : i
          ),
        };
      }
      return { ...prev, items: [...prev.items, { ...itemForm }] };
    });

    setItemForm(defaultItemForm);
  };

  const removeItemFromOrder = (productCode, colorCode) => {
    setOrderForm((prev) => ({
      ...prev,
      items: prev.items.filter((i) => !(i.productCode === productCode && i.colorCode === colorCode)),
    }));
  };

  const saveOrder = async (e) => {
    e.preventDefault();
    if (!orderForm.supplierId || orderForm.items.length === 0) return;

    try {
      setSubmitting(true);
      const supplier = suppliers.find((s) => s.id === orderForm.supplierId);
      const payload = {
        supplierId: orderForm.supplierId,
        supplierName: supplier?.name || orderForm.supplierName,
        items: orderForm.items,
        notes: orderForm.notes,
        expectedDate: orderForm.expectedDate,
        relatedJobs: [],
      };

      const created = await createPurchaseOrder(payload);
      setOrders((prev) => [created, ...prev]);
      setFormOpen(false);
    } catch (err) {
      setError(err.message || 'Sipariş oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  };

  const createFromMissing = async () => {
    if (selectedMissing.length === 0) return;

    // Tedarikçiye göre grupla
    const bySupplier = {};
    selectedMissing.forEach((item) => {
      const key = item.supplierId;
      if (!bySupplier[key]) {
        bySupplier[key] = {
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          items: [],
        };
      }
      bySupplier[key].items.push({
        productCode: item.productCode,
        colorCode: item.colorCode,
        productName: `${item.name} ${item.colorName || ''}`.trim(),
        quantity: item.suggestedQty,
        unit: item.unit,
        unitCost: 0,
      });
    });

    try {
      setSubmitting(true);
      const created = [];
      for (const data of Object.values(bySupplier)) {
        const order = await createPurchaseOrder({
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          items: data.items,
          notes: 'Kritik stok siparişi',
          expectedDate: '',
          relatedJobs: [],
        });
        created.push(order);
      }
      setOrders((prev) => [...created, ...prev]);
      setMissingOpen(false);
      await loadData(); // Refresh missing items
    } catch (err) {
      setError(err.message || 'Sipariş oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const sendOrder = async (orderId) => {
    try {
      setSubmitting(true);
      const updated = await sendPurchaseOrder(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updated);
      }
    } catch (err) {
      setError(err.message || 'Sipariş gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const openDelivery = () => {
    if (!selectedOrder) return;
    setDeliveryForm({
      items: selectedOrder.items.map((i) => ({
        productCode: i.productCode,
        colorCode: i.colorCode,
        productName: i.productName,
        ordered: i.quantity,
        received: i.receivedQty || 0,
        remaining: i.quantity - (i.receivedQty || 0),
        quantity: 0, // Yeni teslim miktarı
      })),
      note: '',
      receivedBy: '',
    });
    setDeliveryOpen(true);
  };

  const saveDelivery = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const deliveryItems = deliveryForm.items
      .filter((i) => i.quantity > 0)
      .map((i) => ({
        productCode: i.productCode,
        colorCode: i.colorCode,
        quantity: i.quantity,
      }));

    if (deliveryItems.length === 0) return;

    try {
      setSubmitting(true);
      const updated = await receivePurchaseDelivery(selectedOrder.id, {
        items: deliveryItems,
        note: deliveryForm.note,
        receivedBy: deliveryForm.receivedBy,
      });
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updated : o)));
      setSelectedOrder(updated);
      setDeliveryOpen(false);
      await loadData(); // Refresh stock
    } catch (err) {
      setError(err.message || 'Teslimat kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSubmitting(true);
      await deletePurchaseOrder(deleteTarget.id);
      setOrders((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'Silinemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const exportToCSV = () => {
    const header = ['Sipariş No', 'Tedarikçi', 'Durum', 'Toplam Tutar', 'Beklenen Tarih', 'Oluşturulma'];
    const rows = filteredOrders.map((o) => [
      o.id,
      o.supplierName,
      STATUS_LABELS[o.status]?.label || o.status,
      o.totalAmount || 0,
      o.expectedDate || '-',
      o.createdAt?.slice(0, 10) || '-',
    ]);

    const csv = [header.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `siparisler-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportOrderToPDF = (order) => {
    // Simple text-based export (could be enhanced with jspdf library)
    const lines = [
      `SİPARİŞ FORMU`,
      `=====================================`,
      `Sipariş No: ${order.id}`,
      `Tedarikçi: ${order.supplierName}`,
      `Tarih: ${order.createdAt?.slice(0, 10)}`,
      `Beklenen Teslimat: ${order.expectedDate || '-'}`,
      ``,
      `KALEMLER:`,
      `-------------------------------------`,
    ];

    order.items?.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.productCode}-${item.colorCode} ${item.productName}`);
      lines.push(`   Miktar: ${item.quantity} ${item.unit} x ${formatCurrency(item.unitCost || 0)} = ${formatCurrency(item.totalCost || 0)}`);
    });

    lines.push(`-------------------------------------`);
    lines.push(`TOPLAM: ${formatCurrency(order.totalAmount || 0)}`);
    lines.push(``);
    lines.push(`Not: ${order.notes || '-'}`);

    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `siparis-${order.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Satınalma Siparişleri"
        subtitle="Sipariş oluşturma, takip ve teslimat yönetimi"
        actions={
          <>
            {missingItems.length > 0 && (
              <button className="btn btn-warning" type="button" onClick={openFromMissing}>
                ⚠️ Eksik Ürünler ({missingItems.length})
              </button>
            )}
            <button className="btn btn-secondary" type="button" onClick={exportToCSV}>
              📥 CSV
            </button>
            <button className="btn btn-primary" type="button" onClick={openCreate}>
              ➕ Yeni Sipariş
            </button>
          </>
        }
      />

      {/* Özet Kartları */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="metric-row">
            <div className="metric-icon">📋</div>
            <div>
              <div className="metric-label">Toplam</div>
              <div className="metric-value">{summary.total}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="metric-row">
            <div className="metric-icon">📝</div>
            <div>
              <div className="metric-label">Taslak</div>
              <div className="metric-value">{summary.draft}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="metric-row">
            <div className="metric-icon">📦</div>
            <div>
              <div className="metric-label">Bekleyen</div>
              <div className="metric-value">{summary.pending}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="metric-row">
            <div className="metric-icon">💰</div>
            <div>
              <div className="metric-label">Toplam Tutar</div>
              <div className="metric-value">{formatCurrency(summary.totalAmount)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div className="filter-group">
          <label className="filter-label">Ara</label>
          <input
            className="filter-input"
            type="search"
            placeholder="Sipariş no, tedarikçi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">Durum</label>
          <select className="filter-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tümü</option>
            <option value="draft">Taslak</option>
            <option value="sent">Gönderildi</option>
            <option value="partial">Kısmi Teslim</option>
            <option value="delivered">Tamamlandı</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Tedarikçi</label>
          <select className="filter-input" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
            <option value="all">Tümü</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Loader text="Siparişler yükleniyor..." />
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Hata</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Sipariş Listesi</h3>
            <span className="badge badge-secondary">{filteredOrders.length} kayıt</span>
          </div>
        <DataTable
          columns={[
              {
                label: 'Sipariş No',
                accessor: 'id',
                render: (val) => <strong>{val}</strong>,
              },
              {
                label: 'Tedarikçi',
                accessor: 'supplierName',
              },
              {
                label: 'Kalem',
                accessor: 'items',
                render: (items) => `${items?.length || 0} kalem`,
              },
              {
                label: 'Tutar',
                accessor: 'totalAmount',
                render: (val) => formatCurrency(val),
              },
              {
                label: 'Durum',
                accessor: 'status',
                render: (val) => {
                  const status = STATUS_LABELS[val] || { label: val, tone: 'secondary' };
                  return (
                    <span className={`badge badge-${status.tone}`}>
                      {status.icon} {status.label}
                    </span>
                  );
                },
              },
              {
                label: 'Beklenen',
                accessor: 'expectedDate',
                render: (val) => val || '-',
              },
              {
                label: 'Aksiyon',
                accessor: 'actions',
                render: (_, row) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-small" type="button" onClick={() => openDetail(row)}>
                      👁️
                    </button>
                    {row.status === 'draft' && (
                      <>
                        <button className="btn btn-success btn-small" type="button" onClick={() => sendOrder(row.id)}>
                          📤
                        </button>
                        <button className="btn btn-danger btn-small" type="button" onClick={() => setDeleteTarget(row)}>
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
            rows={filteredOrders}
          />
        </div>
      )}

      {/* Yeni Sipariş Modal */}
      <Modal
        open={formOpen}
        title="Yeni Sipariş Oluştur"
        size="xlarge"
        onClose={() => setFormOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setFormOpen(false)}>
              İptal
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              form="order-form"
              disabled={submitting || !orderForm.supplierId || orderForm.items.length === 0}
            >
              {submitting ? 'Kaydediliyor...' : 'Sipariş Oluştur'}
            </button>
          </>
        }
      >
        <form id="order-form" onSubmit={saveOrder}>
          <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Tedarikçi *</label>
              <select
                className="form-select"
                value={orderForm.supplierId}
                onChange={(e) => {
                  const supplier = suppliers.find((s) => s.id === e.target.value);
                  setOrderForm((p) => ({
                    ...p,
                    supplierId: e.target.value,
                    supplierName: supplier?.name || '',
                  }));
                }}
                required
              >
                <option value="">Seçin</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.type === 'dealer' ? 'Bayi' : 'Üretici'})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Beklenen Tarih</label>
              <input
                className="form-input"
                type="date"
                value={orderForm.expectedDate}
                onChange={(e) => setOrderForm((p) => ({ ...p, expectedDate: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Not</label>
              <input
                className="form-input"
                value={orderForm.notes}
                onChange={(e) => setOrderForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Sipariş notu..."
              />
            </div>
          </div>

          {/* Ürün Ekleme */}
          <div className="card subtle-card" style={{ padding: 16, marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>➕ Ürün Ekle</h4>
            <div className="form-group">
              <label className="form-label">Ürün Ara</label>
              <input
                className="form-input"
                placeholder="Ürün kodu veya adı..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              {productResults.length > 0 && (
                <div style={{ marginTop: 8, border: '1px solid var(--color-border)', borderRadius: 6, maxHeight: 150, overflow: 'auto' }}>
                  {productResults.map((p) => (
                    <div
                      key={p.id}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                      onClick={() => selectProduct(p)}
                      onKeyDown={(e) => e.key === 'Enter' && selectProduct(p)}
                      tabIndex={0}
                      role="button"
                    >
                      <strong>{p.productCode}</strong>-{p.colorCode} · {p.name} {p.colorName || ''}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-4" style={{ gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Ürün Kodu</label>
                <input
                  className="form-input"
                  value={itemForm.productCode}
                  onChange={(e) => setItemForm((p) => ({ ...p, productCode: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Renk Kodu</label>
                <input
                  className="form-input"
                  value={itemForm.colorCode}
                  onChange={(e) => setItemForm((p) => ({ ...p, colorCode: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Miktar</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={addItemToOrder}
                  disabled={!itemForm.productCode}
                >
                  + Ekle
                </button>
              </div>
            </div>
          </div>

          {/* Eklenen Kalemler */}
          <div className="card subtle-card" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>📦 Sipariş Kalemleri ({orderForm.items.length})</h4>
            {orderForm.items.length === 0 ? (
              <div className="text-muted">Henüz kalem eklenmedi</div>
            ) : (
              <div className="table-container" style={{ maxHeight: 200 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ürün</th>
                      <th>Miktar</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderForm.items.map((item) => (
                      <tr key={`${item.productCode}-${item.colorCode}`}>
                        <td>
                          <strong>{item.productCode}</strong>-{item.colorCode}
                          <div className="text-muted">{item.productName}</div>
                        </td>
                        <td>
                          {item.quantity} {item.unit}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger btn-small btn-icon"
                            onClick={() => removeItemFromOrder(item.productCode, item.colorCode)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Sipariş Detay Modal */}
      <Modal
        open={detailOpen}
        title={`Sipariş Detayı - ${selectedOrder?.id || ''}`}
        size="xlarge"
        onClose={() => {
          setDetailOpen(false);
          setSelectedOrder(null);
        }}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => exportOrderToPDF(selectedOrder)}>
              📄 Dışa Aktar
            </button>
            {['sent', 'partial'].includes(selectedOrder?.status) && (
              <button className="btn btn-success" type="button" onClick={openDelivery}>
                📦 Teslimat Kaydet
              </button>
            )}
            {selectedOrder?.status === 'draft' && (
              <button className="btn btn-primary" type="button" onClick={() => sendOrder(selectedOrder.id)}>
                📤 Siparişi Gönder
              </button>
            )}
          </>
        }
      >
        {selectedOrder && (
          <div>
            {/* Sipariş Bilgileri */}
            <div className="card subtle-card" style={{ marginBottom: 16 }}>
              <div className="grid grid-4" style={{ gap: 16 }}>
                <div>
                  <div className="metric-label">Tedarikçi</div>
                  <div style={{ fontWeight: 600 }}>{selectedOrder.supplierName}</div>
                </div>
                <div>
                  <div className="metric-label">Durum</div>
                  <span className={`badge badge-${STATUS_LABELS[selectedOrder.status]?.tone || 'secondary'}`}>
                    {STATUS_LABELS[selectedOrder.status]?.icon} {STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}
                  </span>
                </div>
                <div>
                  <div className="metric-label">Beklenen Tarih</div>
                  <div style={{ fontWeight: 600 }}>{selectedOrder.expectedDate || '-'}</div>
                </div>
                <div>
                  <div className="metric-label">Toplam</div>
                  <div style={{ fontWeight: 600, fontSize: 18, color: 'var(--color-primary)' }}>
                    {formatCurrency(selectedOrder.totalAmount)}
                  </div>
                </div>
              </div>
            </div>

            {/* Kalemler */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h4 className="card-title">Sipariş Kalemleri</h4>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ürün</th>
                      <th>Miktar</th>
                      <th>Teslim Alınan</th>
                      <th>Kalan</th>
                      <th>Birim Fiyat</th>
                      <th>Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((item, idx) => {
                      const remaining = item.quantity - (item.receivedQty || 0);
                      return (
                        <tr key={`${item.productCode}-${idx}`}>
                          <td>
                            <strong>{item.productCode}</strong>-{item.colorCode}
                            <div className="text-muted">{item.productName}</div>
                          </td>
                          <td>
                            {item.quantity} {item.unit}
                          </td>
                          <td style={{ color: 'var(--color-success)' }}>{item.receivedQty || 0}</td>
                          <td style={{ color: remaining > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                            {remaining}
                          </td>
                          <td>{formatCurrency(item.unitCost || 0)}</td>
                          <td style={{ fontWeight: 600 }}>{formatCurrency(item.totalCost || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Teslimatlar */}
            {selectedOrder.deliveries?.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h4 className="card-title">Teslimat Geçmişi</h4>
                </div>
                <div className="timeline">
                  {selectedOrder.deliveries.map((d) => (
                    <div key={d.id} className="timeline-item">
                      <div className="timeline-point" />
                      <div>
                        <div className="timeline-title">{d.date}</div>
                        <div className="timeline-subtitle">
                          {d.items?.map((i) => `${i.productCode}: ${i.quantity}`).join(', ')}
                        </div>
                        <div className="text-muted">
                          {d.receivedBy && `Teslim alan: ${d.receivedBy}`} {d.note && `· ${d.note}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Teslimat Kayıt Modal */}
      <Modal
        open={deliveryOpen}
        title="📦 Teslimat Kaydet"
        size="xlarge"
        onClose={() => setDeliveryOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setDeliveryOpen(false)}>
              İptal
            </button>
            <button
              className="btn btn-warning"
              type="button"
              onClick={() => {
                // Tümünü doldur
                setDeliveryForm((p) => ({
                  ...p,
                  items: p.items.map((i) => ({ ...i, quantity: i.remaining })),
                }));
              }}
            >
              Tümünü Doldur
            </button>
            <button
              className="btn btn-success"
              type="submit"
              form="delivery-form"
              disabled={submitting || !deliveryForm.items.some((i) => i.quantity > 0)}
            >
              {submitting ? 'Kaydediliyor...' : `✅ ${deliveryForm.items.filter((i) => i.quantity > 0).length} Kalem Kaydet`}
            </button>
          </>
        }
      >
        <form id="delivery-form" onSubmit={saveDelivery}>
          {/* Özet bilgi */}
          <div className="card subtle-card" style={{ padding: 12, marginBottom: 16 }}>
            <div className="grid grid-4" style={{ gap: 16 }}>
              <div>
                <div className="metric-label" style={{ fontSize: 11 }}>Sipariş No</div>
                <strong>{selectedOrder?.id}</strong>
              </div>
              <div>
                <div className="metric-label" style={{ fontSize: 11 }}>Tedarikçi</div>
                <strong>{selectedOrder?.supplierName}</strong>
              </div>
              <div>
                <div className="metric-label" style={{ fontSize: 11 }}>Toplam Kalem</div>
                <strong>{deliveryForm.items.length}</strong>
              </div>
              <div>
                <div className="metric-label" style={{ fontSize: 11 }}>Bu Teslimatta</div>
                <strong style={{ color: 'var(--color-success)' }}>
                  {deliveryForm.items.filter((i) => i.quantity > 0).length} kalem
                </strong>
              </div>
            </div>
          </div>

          <div className="text-muted" style={{ marginBottom: 12, fontSize: 13 }}>
            💡 Her kalem için teslim alınan miktarı girin. <strong>Tab</strong> ile sonraki kaleme geçebilirsiniz.
          </div>

          <div className="table-container" style={{ marginBottom: 16, maxHeight: 350, overflow: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Ürün</th>
                  <th style={{ width: '15%' }}>Sipariş</th>
                  <th style={{ width: '15%' }}>Önceki Alım</th>
                  <th style={{ width: '15%' }}>Kalan</th>
                  <th style={{ width: '20%' }}>Bu Teslimat</th>
                </tr>
              </thead>
              <tbody>
                {deliveryForm.items.map((item, idx) => (
                  <tr
                    key={`${item.productCode}-${idx}`}
                    style={{
                      background: item.quantity > 0 ? 'var(--color-success-bg)' : item.remaining === 0 ? 'var(--color-bg-secondary)' : 'transparent',
                    }}
                  >
                    <td>
                      <strong>{item.productCode}</strong>-{item.colorCode}
                      <div className="text-muted" style={{ fontSize: 12 }}>{item.productName}</div>
                    </td>
                    <td>{formatNumber(item.ordered)}</td>
                    <td style={{ color: item.received > 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                      {formatNumber(item.received)}
                    </td>
                    <td>
                      {item.remaining > 0 ? (
                        <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{formatNumber(item.remaining)}</span>
                      ) : (
                        <span className="badge badge-success">Tamam</span>
                      )}
                    </td>
                    <td>
                      {item.remaining > 0 ? (
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          max={item.remaining}
                          value={item.quantity}
                          onChange={(e) => {
                            const qty = Math.min(Math.max(0, Number(e.target.value)), item.remaining);
                            setDeliveryForm((p) => ({
                              ...p,
                              items: p.items.map((i, iIdx) => (iIdx === idx ? { ...i, quantity: qty } : i)),
                            }));
                          }}
                          onFocus={(e) => e.target.select()}
                          style={{ width: 90 }}
                        />
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-2" style={{ gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Teslim Alan *</label>
              <input
                className="form-input"
                value={deliveryForm.receivedBy}
                onChange={(e) => setDeliveryForm((p) => ({ ...p, receivedBy: e.target.value }))}
                placeholder="Teslim alan kişinin adı..."
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Not (opsiyonel)</label>
              <input
                className="form-input"
                value={deliveryForm.note}
                onChange={(e) => setDeliveryForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Teslimat notu, irsaliye no vb..."
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Eksik Ürünler Modal */}
      <Modal
        open={missingOpen}
        title="⚠️ Eksik Ürünler - Toplu Sipariş"
        size="xlarge"
        onClose={() => setMissingOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setMissingOpen(false)}>
              Kapat
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={submitting || selectedMissing.length === 0}
              onClick={createFromMissing}
            >
              {submitting ? 'Oluşturuluyor...' : `📦 ${selectedMissing.length} Ürün İçin Sipariş Oluştur`}
            </button>
          </>
        }
      >
        <div className="text-muted" style={{ marginBottom: 16 }}>
          Aşağıdaki ürünler kritik stok seviyesinin altında. Sipariş vermek istediklerinizi seçin:
        </div>

        <div className="table-container" style={{ maxHeight: 400 }}>
          <table className="table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedMissing.length === missingItems.length && missingItems.length > 0}
                    onChange={(e) => setSelectedMissing(e.target.checked ? [...missingItems] : [])}
                  />
                </th>
                <th>Ürün</th>
                <th>Tedarikçi</th>
                <th>Mevcut</th>
                <th>Kritik</th>
                <th>Önerilen</th>
              </tr>
            </thead>
            <tbody>
              {missingItems.map((item) => (
                <tr key={item.itemId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedMissing.some((m) => m.itemId === item.itemId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMissing((p) => [...p, item]);
                        } else {
                          setSelectedMissing((p) => p.filter((m) => m.itemId !== item.itemId));
                        }
                      }}
                    />
                  </td>
                  <td>
                    <strong>{item.productCode}</strong>-{item.colorCode}
                    <div className="text-muted">{item.name}</div>
                  </td>
                  <td>{item.supplierName}</td>
                  <td style={{ color: 'var(--color-danger)' }}>{formatNumber(item.available)}</td>
                  <td>{formatNumber(item.critical)}</td>
                  <td style={{ fontWeight: 600 }}>{formatNumber(item.suggestedQty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Silme Onay Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        title="Silme Onayı"
        size="small"
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setDeleteTarget(null)}>
              Vazgeç
            </button>
            <button className="btn btn-danger" type="button" onClick={confirmDelete} disabled={submitting}>
              Sil
            </button>
          </>
        }
      >
        <p>
          <strong>{deleteTarget?.id}</strong> siparişini silmek istediğinize emin misiniz?
        </p>
      </Modal>
    </div>
  );
};

export default SatinalmaSiparisler;
