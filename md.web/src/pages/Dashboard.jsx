import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { getDashboardData, getJobs, getCriticalStock, getMissingItems, getPurchaseOrdersFromAPI, getProductionAlerts } from '../services/dataService';

const PENDING_STATUSES = [
  'OLCU_RANDEVU_BEKLIYOR',
  'SERVIS_RANDEVU_BEKLIYOR',
];

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} dk önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays === 0) return 'Bugün';
  if (diffDays === 1) return 'Dün';
  return `${diffDays} gün önce`;
};

const Dashboard = () => {
  const [dashboard, setDashboard] = useState({
    stats: [],
    activities: [],
    priorityJobs: [],
    weekOverview: [],
    paymentStatus: {},
    teamStatus: {},
  });
  const [pendingAppointments, setPendingAppointments] = useState([]);
  const [criticalStock, setCriticalStock] = useState([]);
  const [missingItems, setMissingItems] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [productionAlerts, setProductionAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [dashboardPayload, jobsPayload, criticalData, missingData, ordersData, prodAlerts] = await Promise.all([
          getDashboardData(),
          getJobs().catch(() => []),
          getCriticalStock().catch(() => []),
          getMissingItems().catch(() => []),
          getPurchaseOrdersFromAPI().catch(() => []),
          getProductionAlerts().catch(() => []),
        ]);
        setDashboard(dashboardPayload);
        
        // Randevu bekleyen işleri filtrele
        const pending = (jobsPayload || [])
          .filter((job) => PENDING_STATUSES.includes(job.status))
          .slice(0, 5);
        setPendingAppointments(pending);
        
        // Stok uyarıları
        setCriticalStock((criticalData || []).slice(0, 5));
        setMissingItems((missingData || []).slice(0, 5));
        
        // Bekleyen siparişler
        const pendingPO = (ordersData || [])
          .filter((o) => ['sent', 'partial'].includes(o.status))
          .slice(0, 5);
        setPendingOrders(pendingPO);
        
        // Üretim uyarıları
        setProductionAlerts((prodAlerts || []).slice(0, 5));
      } catch (err) {
        setError(err.message || 'Bilinmeyen bir hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader title="Kontrol Paneli" subtitle="İş süreçlerinizin genel durumunu görüntüleyin" />

      {loading ? (
        <div className="card subtle-card">Veriler yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Veri alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            {dashboard.stats.map((stat) => (
              <StatCard
                key={stat.id}
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                change={stat.change}
                trend={stat.trend}
                tone={stat.tone}
              />
            ))}
          </div>

          {/* Randevu Bekleyen İşler - Dikkat Gerektiren */}
          {pendingAppointments.length > 0 && (
            <div className="card" style={{ marginTop: 24, border: '2px solid var(--color-warning)', background: 'var(--color-warning-bg)' }}>
              <div className="card-header" style={{ borderBottom: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🔔</span>
                  Randevu Bekliyor
                  <span className="badge badge-warning" style={{ marginLeft: 8 }}>{pendingAppointments.length}</span>
                </h3>
                <Link to="/isler/list" className="btn btn-secondary btn-small">
                  Tümünü Gör
                </Link>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {pendingAppointments.map((job) => (
                    <Link
                      key={job.id}
                      to="/isler/list"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(245, 158, 11, 0.1)',
                        textDecoration: 'none',
                        color: 'inherit',
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 18 }}>
                          {job.startType === 'SERVIS' ? '🔧' : '📐'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                            {job.title} • {job.roles?.map(r => r.name).join(', ') || 'İş kolu belirtilmemiş'}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="badge badge-warning" style={{ fontSize: 11 }}>
                          {job.startType === 'SERVIS' ? 'Servis' : 'Ölçü'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginTop: 4 }}>
                          {formatTimeAgo(job.createdAt)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="card-footer" style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '10px 16px', fontSize: 12, color: 'var(--color-text-light)' }}>
                💡 Bu müşterileri arayıp randevu belirlemeniz gerekiyor.
              </div>
            </div>
          )}

          {/* Üretim/Tedarik Uyarıları */}
          {productionAlerts.length > 0 && (
            <div className="card" style={{ marginTop: 24, border: '2px solid var(--color-danger)', background: 'var(--color-danger-bg)' }}>
              <div className="card-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🏭</span>
                  Üretim/Tedarik Uyarıları
                  <span className="badge badge-danger" style={{ marginLeft: 8 }}>{productionAlerts.length}</span>
                </h3>
                <Link to="/uretim/siparisler" className="btn btn-secondary btn-small">
                  Tümünü Gör
                </Link>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {productionAlerts.map((alert, idx) => (
                    <Link
                      key={idx}
                      to={`/isler/list?job=${alert.jobId}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(239, 68, 68, 0.1)',
                        textDecoration: 'none',
                        color: 'inherit',
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 18 }}>
                          {alert.type === 'overdue' ? '⏰' : alert.type === 'due_today' ? '📅' : '⚠️'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{alert.message}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                            {alert.jobTitle} • {alert.roleName}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className={`badge badge-${alert.severity === 'high' ? 'danger' : 'warning'}`} style={{ fontSize: 11 }}>
                          {alert.type === 'overdue' ? 'GECİKTİ' : alert.type === 'due_today' ? 'BUGÜN' : 'SORUN'}
                        </div>
                        {alert.estimatedDelivery && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginTop: 4 }}>
                            {new Date(alert.estimatedDelivery).toLocaleDateString('tr-TR')}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="card-footer" style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '10px 16px', fontSize: 12, color: 'var(--color-text-light)' }}>
                💡 Geciken veya sorunlu siparişler acil müdahale gerektiriyor.
              </div>
            </div>
          )}

          {/* Stok ve Satınalma Uyarıları */}
          {(criticalStock.length > 0 || missingItems.length > 0 || pendingOrders.length > 0) && (
            <div className="grid grid-3" style={{ marginTop: 24 }}>
              {/* Kritik Stok */}
              {criticalStock.length > 0 && (
                <div className="card" style={{ border: '2px solid var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                  <div className="card-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>⚠️</span>
                      Kritik Stok
                      <span className="badge badge-danger" style={{ marginLeft: 4 }}>{criticalStock.length}</span>
                    </h3>
                    <Link to="/stok/kritik" className="btn btn-secondary btn-small">
                      Tümü
                    </Link>
                  </div>
                  <div style={{ padding: '8px 0' }}>
                    {criticalStock.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 16px',
                          borderBottom: '1px solid rgba(239, 68, 68, 0.1)',
                          fontSize: 13,
                        }}
                      >
                        <span>
                          <strong>{item.productCode}</strong>-{item.colorCode}
                          <div className="text-muted" style={{ fontSize: 11 }}>{item.name}</div>
                        </span>
                        <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                          {item.available} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Eksik Ürünler */}
              {missingItems.length > 0 && (
                <div className="card" style={{ border: '2px solid var(--color-warning)', background: 'var(--color-warning-bg)' }}>
                  <div className="card-header" style={{ borderBottom: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>📦</span>
                      Sipariş Gerekli
                      <span className="badge badge-warning" style={{ marginLeft: 4 }}>{missingItems.length}</span>
                    </h3>
                    <Link to="/satinalma/eksik" className="btn btn-secondary btn-small">
                      Sipariş Ver
                    </Link>
                  </div>
                  <div style={{ padding: '8px 0' }}>
                    {missingItems.map((item) => (
                      <div
                        key={item.itemId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 16px',
                          borderBottom: '1px solid rgba(245, 158, 11, 0.1)',
                          fontSize: 13,
                        }}
                      >
                        <span>
                          <strong>{item.productCode}</strong>-{item.colorCode}
                          <div className="text-muted" style={{ fontSize: 11 }}>{item.name}</div>
                        </span>
                        <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>
                          +{item.suggestedQty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bekleyen Siparişler */}
              {pendingOrders.length > 0 && (
                <div className="card" style={{ border: '2px solid var(--color-info)', background: 'var(--color-info-bg)' }}>
                  <div className="card-header" style={{ borderBottom: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>🚚</span>
                      Bekleyen PO
                      <span className="badge badge-info" style={{ marginLeft: 4 }}>{pendingOrders.length}</span>
                    </h3>
                    <Link to="/satinalma/bekleyen" className="btn btn-secondary btn-small">
                      Tümü
                    </Link>
                  </div>
                  <div style={{ padding: '8px 0' }}>
                    {pendingOrders.map((order) => (
                      <div
                        key={order.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 16px',
                          borderBottom: '1px solid rgba(59, 130, 246, 0.1)',
                          fontSize: 13,
                        }}
                      >
                        <span>
                          <strong>{order.id}</strong>
                          <div className="text-muted" style={{ fontSize: 11 }}>{order.supplierName}</div>
                        </span>
                        <span>
                          <span className={`badge badge-${order.status === 'partial' ? 'warning' : 'info'}`} style={{ fontSize: 10 }}>
                            {order.status === 'partial' ? 'Kısmi' : 'Bekliyor'}
                          </span>
                          {order.expectedDate && (
                            <div className="text-muted" style={{ fontSize: 10, marginTop: 2 }}>{order.expectedDate}</div>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-2" style={{ marginTop: 24 }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Son Aktiviteler</h3>
                <button className="btn btn-secondary btn-icon" type="button">
                  ⋯
                </button>
              </div>
              <div className="card-body">
                <DataTable
                  columns={[
                    { label: 'İşlem', accessor: 'action' },
                    { label: 'Kullanıcı', accessor: 'user' },
                    { label: 'Tarih', accessor: 'time' },
                  ]}
                  rows={dashboard.activities}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Öncelikli İşler</h3>
                <button className="btn btn-secondary" type="button">
                  Tümünü Gör
                </button>
              </div>
              <div className="card-body">
                <DataTable
                  columns={[
                    { label: 'İş Adı', accessor: 'name' },
                    {
                      label: 'Durum',
                      accessor: 'status',
                      render: (_value, row) => renderBadge(row.status, row.badge),
                    },
                    { label: 'Termin', accessor: 'dueDate' },
                  ]}
                  rows={dashboard.priorityJobs}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-3" style={{ marginTop: 24 }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Bu Hafta</h3>
              </div>
              <div className="card-body">
                <div className="metric-list">
                  {dashboard.weekOverview.map((item) => (
                    <div className="metric-row" key={item.label}>
                      <span className="metric-label">{item.label}</span>
                      <span className="metric-value">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Ödeme Durumu</h3>
              </div>
              <div className="card-body">
                <div className="metric-list">
                  <div className="metric-row">
                    <span className="metric-label">Bekleyen</span>
                    <span className="metric-value warning">{dashboard.paymentStatus.pending}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Bu Ay Tahsilat</span>
                    <span className="metric-value success">{dashboard.paymentStatus.collected}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Bu Ay Ödeme</span>
                    <span className="metric-value danger">{dashboard.paymentStatus.paid}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Ekip Durumu</h3>
              </div>
              <div className="card-body">
                <div className="metric-list">
                  <div className="metric-row">
                    <span className="metric-label">Atölye</span>
                    <span className="metric-value">{dashboard.teamStatus.workshop} kişi</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Montaj</span>
                    <span className="metric-value">{dashboard.teamStatus.assembly} kişi</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Ofis</span>
                    <span className="metric-value">{dashboard.teamStatus.office} kişi</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const renderBadge = (text, type = 'secondary') => (
  <span className={`badge badge-${type}`}>{text}</span>
);

export default Dashboard;

