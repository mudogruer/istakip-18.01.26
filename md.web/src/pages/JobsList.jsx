import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import PhoneInput from '../components/PhoneInput';
import {
  completeAssembly,
  createCustomer,
  createJob,
  getCustomers,
  getJob,
  getJobs,
  scheduleAssembly,
  startJobApproval,
  updateJobMeasure,
  updateJobOffer,
  updateProductionStatus,
  updateStockStatus,
  closeFinance,
  getStockItems,
  applyLocalStockReservation,
  getJobRoles,
  getJobLogs,
  addJobLog,
  updateJobStatus,
  applyLocalJobPatch,
  createLocalPurchaseOrders,
  uploadDocument,
  getJobDocuments,
  deleteDocument,
  getDocumentDownloadUrl,
  bulkReserveStock,
  getProductionOrdersByJob,
  createProductionOrder,
  recordProductionDelivery,
  getJobRolesConfig,
  getSuppliersFromAPI,
  getGlassTypes,
  getProductionCombinations,
} from '../services/dataService';

const normalizeJob = (job) => ({
  ...job,
  roles: Array.isArray(job?.roles) ? job.roles : [],
  payments: job?.payments || {},
  offer: job?.offer || {},
  files: job?.files || {},
  measure: job?.measure || {},
  pendingPO: job?.pendingPO || [],
});

const toMessage = (err) => {
  if (!err) return 'Bilinmeyen hata';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.detail) return err.detail;
  try {
    return JSON.stringify(err);
  } catch (e) {
    return String(err);
  }
};

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);

// Tutar girişi için formatlama fonksiyonları
const formatCurrency = (value) => {
  if (!value && value !== 0) return '';
  // Sadece rakamları al
  const numericValue = String(value).replace(/[^\d]/g, '');
  if (!numericValue) return '';
  return new Intl.NumberFormat('tr-TR').format(Number(numericValue));
};

const parseCurrency = (formattedValue) => {
  if (!formattedValue) return '';
  // Noktaları kaldır, virgülü noktaya çevir (eğer küsürat varsa)
  const cleaned = String(formattedValue).replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? '' : num;
};

// Formatlı tutar input bileşeni
const CurrencyInput = ({ value, onChange, placeholder, className = 'form-input', style = {} }) => {
  const [displayValue, setDisplayValue] = useState('');
  
  useEffect(() => {
    if (value !== undefined && value !== null && value !== '') {
      setDisplayValue(formatCurrency(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);
  
  const handleChange = (e) => {
    const input = e.target.value;
    // Sadece rakam ve nokta/virgül kabul et
    const cleaned = input.replace(/[^\d.,]/g, '');
    
    // Formatlı göster
    const numericOnly = cleaned.replace(/[^\d]/g, '');
    const formatted = numericOnly ? new Intl.NumberFormat('tr-TR').format(Number(numericOnly)) : '';
    setDisplayValue(formatted);
    
    // Gerçek değeri parent'a gönder
    onChange(numericOnly ? Number(numericOnly) : '');
  };
  
  return (
    <input
      type="text"
      className={className}
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      style={{ textAlign: 'right', ...style }}
    />
  );
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const JobsList = () => {
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [form, setForm] = useState({
    customerId: '',
    customerName: '',
    startType: 'OLCU',
    title: '',
    // Yeni müşteri için genişletilmiş alanlar
    phone: '+90 ',
    phone2: '',
    address: '',
    newCustomer: false,
    segment: 'B2B',
    location: '',
    contact: '',
    roles: [],
    // Arşiv kaydı için
    isArchive: false,
    archiveDate: '',
    archiveCompletedDate: '',
    archiveTotalAmount: '',
    archiveNote: '',
    // Müşteri ölçüsü için dosyalar
    customerFiles: [],
    // Servis için
    serviceNote: '',
    serviceFixedFee: '',
  });
  const [jobRoles, setJobRoles] = useState([]);
  const [roleSearch, setRoleSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [jobsPayload, customersPayload] = await Promise.all([getJobs(), getCustomers()]);
        setJobs(jobsPayload.map(normalizeJob));
        setCustomers(customersPayload.filter((c) => !c.deleted));
        const rolesPayload = await getJobRoles();
        setJobRoles(rolesPayload);
      } catch (err) {
        setError(err.message || 'İş listesi alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return jobs
      .filter((job) => {
        if (statusFilter === 'all') return true;
        // Tam eşleşme kontrolü (büyük/küçük harf duyarsız)
        return (job.status || '').toUpperCase() === statusFilter.toUpperCase();
      })
      .filter((job) => {
        if (!normalizedSearch) return true;
        return (
          (job.title || '').toLowerCase().includes(normalizedSearch) ||
          (job.customerName || '').toLowerCase().includes(normalizedSearch) ||
          (job.id || '').toLowerCase().includes(normalizedSearch)
        );
      });
  }, [jobs, search, statusFilter]);

  const columns = [
    { label: 'İş Kodu', accessor: 'id' },
    { label: 'Başlık', accessor: 'title' },
    { label: 'Müşteri', accessor: 'customerName' },
    {
      label: 'İş Kolları',
      accessor: 'roles',
      render: (_v, row) =>
        !row.roles || row.roles.length === 0 ? (
          <span className="text-muted">Belirtilmemiş</span>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {row.roles.map((r) => (
              <span key={r.id || r.name} className="badge badge-secondary">
                {r.name}
              </span>
            ))}
          </div>
        ),
    },
    {
      label: 'Durum',
      accessor: 'status',
      render: (_value, row) => renderStatus(row.status),
    },
    { 
      label: 'Başlatma', 
      accessor: 'startType',
      render: (_value, row) => {
        const labels = {
          'OLCU': '📐 Ölçü',
          'MUSTERI_OLCUSU': '📄 Müşteri Ölçüsü',
          'SERVIS': '🔧 Servis',
          'ARSIV': '📂 Arşiv',
        };
        return (
          <span className={row.isArchive || row.startType === 'ARSIV' ? 'badge badge-secondary' : ''}>
            {labels[row.startType] || row.startType}
          </span>
        );
      }
    },
  ];

  const openDetail = async (job) => {
    setDetailModal(true);
    setDetailLoading(true);
    setDetailError('');
    setSelectedJob(normalizeJob(job));
    try {
      const payload = await getJob(job.id);
      setSelectedJob(normalizeJob(payload));
    } catch (err) {
      setDetailError(err.message || 'İş detayı alınamadı');
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleRole = (role) => {
    setForm((prev) => {
      const exists = prev.roles.find((r) => r.id === role.id);
      if (exists) {
        return { ...prev, roles: prev.roles.filter((r) => r.id !== role.id) };
      }
      return { ...prev, roles: [...prev.roles, role] };
    });
  };

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return jobRoles;
    return jobRoles.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
    );
  }, [jobRoles, roleSearch]);

  // Müşteri arama (isim veya telefon ile)
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    // En az 2 karakter girilmeli
    if (q.length < 2) return [];
    
    return customers.filter((c) => {
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const phoneMatch = (c.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''));
      const phone2Match = (c.phone2 || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''));
      return nameMatch || phoneMatch || phone2Match;
    }).slice(0, 10); // Max 10 sonuç
  }, [customers, customerSearch]);

  return (
    <div>
      <PageHeader
        title="İş Listesi"
        subtitle="Aktif tüm işlerinizi tek ekranda takip edin"
        actions={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setForm({
                customerId: '',
                customerName: '',
                startType: 'OLCU',
                title: '',
                newCustomer: false,
                segment: 'B2B',
                location: '',
                contact: '',
                roles: [],
                isArchive: false,
                archiveDate: '',
                archiveCompletedDate: '',
                archiveTotalAmount: '',
                archiveNote: '',
              });
              setShowModal(true);
            }}
          >
            + Yeni İş Başlat
          </button>
        }
      />

      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label" htmlFor="search">
            Arama
          </label>
          <input
            id="search"
            className="filter-input"
            type="search"
            placeholder="İş adı, müşteri veya iş kodu"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="status">
            Durum
          </label>
          <select
            id="status"
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Tümü</option>
            <optgroup label="Ölçü/Keşif">
              <option value="OLCU_RANDEVU_BEKLIYOR">Randevu Bekliyor</option>
              <option value="OLCU_RANDEVULU">Randevu Verildi</option>
              <option value="OLCU_ALINDI">Ölçü Alındı</option>
              <option value="MUSTERI_OLCUSU_BEKLENIYOR">Müşteri Ölçüsü Bekleniyor</option>
              <option value="MUSTERI_OLCUSU_YUKLENDI">Müşteri Ölçüsü Yüklendi</option>
            </optgroup>
            <optgroup label="Fiyatlandırma">
              <option value="FIYATLANDIRMA">Fiyat Verilecek</option>
              <option value="FIYAT_VERILDI">Fiyat Verildi - Onay Bekliyor</option>
              <option value="ANLASILAMADI">Anlaşılamadı</option>
            </optgroup>
            <optgroup label="Anlaşma">
              <option value="ANLASMA_YAPILIYOR">Anlaşma Yapılıyor</option>
              <option value="ANLASMA_TAMAMLANDI">Anlaşma Tamamlandı</option>
            </optgroup>
            <optgroup label="Stok/Rezervasyon">
              <option value="SONRA_URETILECEK">Sonra Üretilecek</option>
            </optgroup>
            <optgroup label="Üretim">
              <option value="URETIME_HAZIR">Üretime Hazır</option>
              <option value="URETIMDE">Üretimde</option>
            </optgroup>
            <optgroup label="Montaj">
              <option value="MONTAJA_HAZIR">Montaja Hazır</option>
              <option value="MONTAJ_TERMIN">Montaj Terminli</option>
            </optgroup>
            <optgroup label="Finans">
              <option value="MUHASEBE_BEKLIYOR">Muhasebe Bekliyor</option>
              <option value="KAPALI">Kapalı</option>
            </optgroup>
            <optgroup label="Servis">
              <option value="SERVIS_RANDEVU_BEKLIYOR">Servis Randevusu Bekliyor</option>
              <option value="SERVIS_RANDEVULU">Servis Randevulu</option>
              <option value="SERVIS_YAPILIYOR">Servis Yapılıyor</option>
              <option value="SERVIS_DEVAM_EDIYOR">Servis Devam Ediyor</option>
              <option value="SERVIS_ODEME_BEKLIYOR">Servis Ödeme Bekliyor</option>
              <option value="SERVIS_KAPALI">Servis Tamamlandı</option>
            </optgroup>
          </select>
        </div>
      </div>

      {loading ? (
        <Loader text="İşler yükleniyor..." />
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Liste yüklenemedi</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filteredJobs}
          getKey={(row) => row.id}
          onRowClick={openDetail}
          />
      )}

      <Modal
        open={showModal}
        title="🆕 Yeni İş Başlat"
        size="large"
        onClose={() => {
          setShowModal(false);
          setCustomerSearch('');
        }}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} disabled={submitting}>
              Vazgeç
            </button>
            <button className="btn btn-primary" type="submit" form="job-modal-form" disabled={submitting}>
              {submitting ? 'Kaydediliyor...' : form.isArchive ? '📂 Arşive Kaydet' : 'İşi Başlat'}
            </button>
          </>
        }
      >
        <form
          id="job-modal-form"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              setSubmitting(true);
              setError('');

              let customerId = form.customerId;
              let customerName = form.customerName;

              if (form.newCustomer) {
                const created = await createCustomer({
                  name: form.customerName,
                  segment: form.segment,
                  phone: form.phone,
                  phone2: form.phone2,
                  address: form.address,
                  location: form.location,
                  contact: form.contact,
                });
                customerId = created.id;
                customerName = created.name;
                setCustomers((prev) => [created, ...prev]);
              }

              // Arşiv kaydı için özel payload
              const jobPayload = {
                customerId,
                customerName,
                title: form.title,
                startType: form.isArchive ? 'ARSIV' : form.startType,
                roles: form.roles,
              };

              // Arşiv ise ek bilgiler ekle
              if (form.isArchive) {
                jobPayload.isArchive = true;
                jobPayload.archiveDate = form.archiveDate;
                jobPayload.archiveCompletedDate = form.archiveCompletedDate;
                jobPayload.archiveTotalAmount = form.archiveTotalAmount ? Number(form.archiveTotalAmount) : null;
                jobPayload.archiveNote = form.archiveNote;
              }

              const job = await createJob(jobPayload);
              setJobs((prev) => [normalizeJob(job), ...prev]);
              setForm((prev) => ({
                ...prev,
                roles: [],
                isArchive: false,
                archiveDate: '',
                archiveCompletedDate: '',
                archiveTotalAmount: '',
                archiveNote: '',
              }));
              setCustomerSearch('');
              setShowModal(false);
            } catch (err) {
              setError(err.message || 'İş oluşturulamadı');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {/* BÖLÜM 1: MÜŞTERİ */}
          <div className="card subtle-card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <h4 className="card-title" style={{ fontSize: 14 }}>👤 Müşteri</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                  className={`btn btn-small ${!form.newCustomer ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForm((prev) => ({ ...prev, newCustomer: false }))}
                >
                  Mevcut
                  </button>
                <button
                  type="button"
                  className={`btn btn-small ${form.newCustomer ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForm((prev) => ({ ...prev, newCustomer: true, customerId: '', customerName: '' }))}
                >
                  + Yeni
                </button>
            </div>
            </div>
            <div className="card-body" style={{ padding: 16 }}>
              {!form.newCustomer ? (
                // MEVCUT MÜŞTERİ ARAMA
                <div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">🔍 Müşteri Ara (İsim veya Telefon)</label>
                <input
                      className="form-input"
                      placeholder="Örn: Ahmet veya 532 123..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      autoFocus
                />
              </div>
                  
                  {/* Seçili Müşteri */}
                  {form.customerId && (
                    <div style={{ 
                      padding: 12, 
                      background: 'var(--color-success-bg)', 
                      borderRadius: 8, 
                      border: '1px solid var(--color-success)',
                      marginBottom: 12
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>✓ {form.customerName}</div>
                          {(() => {
                            const c = customers.find(c => c.id === form.customerId);
                            return c?.phone ? <div style={{ fontSize: 12 }}>📞 {c.phone}</div> : null;
                          })()}
            </div>
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                          onClick={() => setForm((prev) => ({ ...prev, customerId: '', customerName: '' }))}
                            >
                          Değiştir
                            </button>
            </div>
          </div>
                  )}

                  {/* Arama Sonuçları */}
                  {!form.customerId && customerSearch.length >= 2 && (
                    <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                      {filteredCustomers.length === 0 ? (
                        <div style={{ padding: 16, textAlign: 'center' }} className="text-muted">
                          "{customerSearch}" ile eşleşen müşteri bulunamadı
                        </div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <div
                            key={c.id}
                            style={{ 
                              padding: '10px 16px', 
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--color-border)',
                              transition: 'background 0.2s'
                            }}
                            className="hover-row"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, customerId: c.id, customerName: c.name }));
                              setCustomerSearch('');
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                              {c.phone && `📞 ${c.phone}`}
                              {c.phone && c.address && ' • '}
                              {c.address && `📍 ${c.address.substring(0, 30)}...`}
          </div>
            </div>
                        ))
                      )}
          </div>
                  )}
                  
                  {!form.customerId && customerSearch.length < 2 && (
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      💡 En az 2 karakter girerek müşteri arayın
                    </div>
                  )}
            </div>
          ) : (
                // YENİ MÜŞTERİ FORMU
                <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Ad Soyad *</label>
                <input
                  className="form-input"
                  value={form.customerName}
                  onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))}
                      placeholder="Örn: Ahmet Yılmaz"
                  required
                />
              </div>
              <div className="form-group">
                    <PhoneInput
                      label="📞 Telefon 1 *"
                      value={form.phone}
                      onChange={(val) => setForm((prev) => ({ ...prev, phone: val }))}
                      required
                    />
            </div>
                  <div className="form-group">
                    <PhoneInput
                      label="📞 Telefon 2 (isteğe bağlı)"
                      value={form.phone2}
                      onChange={(val) => setForm((prev) => ({ ...prev, phone2: val }))}
                    />
          </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">📍 Adres</label>
                    <textarea
                      className="form-textarea"
                      value={form.address}
                      onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="Tam adres..."
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Segment</label>
              <select
                className="form-select"
                  value={form.segment}
                  onChange={(e) => setForm((prev) => ({ ...prev, segment: e.target.value }))}
                >
                      <option value="B2C">Bireysel (B2C)</option>
                      <option value="B2B">Kurumsal (B2B)</option>
              </select>
            </div>
              <div className="form-group">
                    <label className="form-label">İlçe / Semt</label>
                <input
                  className="form-input"
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                      placeholder="Örn: Kadıköy"
                />
              </div>
                </div>
              )}
            </div>
          </div>

          {/* BÖLÜM 2: İŞ BİLGİLERİ */}
          <div className="card subtle-card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <h4 className="card-title" style={{ fontSize: 14 }}>📋 İş Bilgileri</h4>
            </div>
            <div className="card-body" style={{ padding: 16 }}>
              <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                  <label className="form-label">İş Başlığı *</label>
                <input
                  className="form-input"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Örn: Balkon PVC Doğrama"
                  required
                />
              </div>
              <div className="form-group">
                  <label className="form-label">Başlatma Türü</label>
                <select
                  className="form-select"
                    value={form.isArchive ? 'ARSIV' : form.startType}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'ARSIV') {
                        setForm((prev) => ({ ...prev, isArchive: true, startType: 'OLCU' }));
                      } else {
                        setForm((prev) => ({ ...prev, isArchive: false, startType: val }));
                      }
                    }}
                  >
                    <option value="OLCU">📐 Ölçü Randevusu</option>
                    <option value="MUSTERI_OLCUSU">📄 Müşteri Ölçüsü</option>
                    <option value="SERVIS">🔧 Servis/Bakım</option>
                    <option value="ARSIV">📂 Arşiv Kaydı (Tamamlanmış İş)</option>
                </select>
              </div>
              </div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                {!form.isArchive && form.startType === 'OLCU' && '💡 Ölçü randevusu verilecek, sonra fiyatlandırılacak.'}
                {!form.isArchive && form.startType === 'MUSTERI_OLCUSU' && '💡 Müşteri ölçüsü ile direkt fiyatlandırmaya geçilecek.'}
                {!form.isArchive && form.startType === 'SERVIS' && '💡 Servis randevusu ve sabit ücret belirlenecek.'}
                {form.isArchive && '📂 Geçmişte tamamlanmış bir işi sisteme kaydedin. Süreç haritası atlanır.'}
              </div>

              {/* ARŞİV KAYDI ALANLARI */}
              {form.isArchive && (
                <div style={{ 
                  marginTop: 16, 
                  padding: 16, 
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
                  borderRadius: 12,
                  border: '1px solid #f59e0b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>📂</span>
                    <span style={{ fontWeight: 600, color: '#92400e' }}>Arşiv Bilgileri</span>
                  </div>
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">📅 Anlaşma Tarihi *</label>
                <input
                        type="date"
                  className="form-input"
                        value={form.archiveDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, archiveDate: e.target.value }))}
                        required={form.isArchive}
                        max={new Date().toISOString().split('T')[0]}
                />
              </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">📅 Tamamlanma Tarihi</label>
                <input
                        type="date"
                  className="form-input"
                        value={form.archiveCompletedDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, archiveCompletedDate: e.target.value }))}
                        max={new Date().toISOString().split('T')[0]}
                />
              </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">💰 Toplam Tutar (₺)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={form.archiveTotalAmount}
                        onChange={(e) => setForm((prev) => ({ ...prev, archiveTotalAmount: e.target.value }))}
                        placeholder="Örn: 15000"
                        min="0"
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                      <label className="form-label">📝 Not (Opsiyonel)</label>
                      <textarea
                        className="form-input"
                        value={form.archiveNote}
                        onChange={(e) => setForm((prev) => ({ ...prev, archiveNote: e.target.value }))}
                        placeholder="Arşiv kaydı ile ilgili notlar..."
                        rows={2}
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BÖLÜM 3: İŞ KOLLARI */}
          <div className="card subtle-card">
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <h4 className="card-title" style={{ fontSize: 14 }}>🏭 İş Kolları</h4>
              <span className="badge badge-secondary">{form.roles.length} seçili</span>
            </div>
            <div className="card-body" style={{ padding: 16 }}>
              {/* Seçili İş Kolları */}
              {form.roles.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {form.roles.map((role) => (
                    <span 
                      key={role.id} 
                      className="badge badge-primary" 
                      style={{ 
                        padding: '6px 12px', 
                        display: 'inline-flex', 
                        gap: 8, 
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleRole(role)}
                    >
                      {role.name}
                      <span style={{ opacity: 0.7 }}>✕</span>
                    </span>
                  ))}
                </div>
              )}
              
              {/* İş Kolu Seçici - Grid Layout */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                gap: 8 
              }}>
                {jobRoles.map((role) => {
                  const isSelected = form.roles.some((r) => r.id === role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      style={{
                        padding: '10px 12px',
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        borderRadius: 8,
                        background: isSelected ? 'var(--color-primary-bg)' : 'var(--color-bg-secondary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => toggleRole(role)}
                    >
                      <div style={{ 
                        fontWeight: 600, 
                        fontSize: 13,
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-text)'
                      }}>
                        {isSelected && '✓ '}{role.name}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {form.roles.length === 0 && (
                <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                  ⚠️ En az bir iş kolu seçin
                </div>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={detailModal}
        title={`İş Detayı ${selectedJob ? `- ${selectedJob.id}` : ''}`}
        size="xxlarge"
        onClose={() => {
          setDetailModal(false);
          setSelectedJob(null);
          setDetailError('');
        }}
      >
        {detailLoading ? (
          <div>Yükleniyor...</div>
        ) : detailError ? (
          <div className="error-card">
            <div className="error-title">Hata</div>
            <div className="error-message">{detailError}</div>
          </div>
        ) : selectedJob ? (
          <JobStepper
            job={selectedJob}
            customers={customers}
            onUpdated={async (updated) => {
              setSelectedJob(updated);
              setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
};

const STATUS_LABELS = {
  // Ölçü aşaması statüleri
  'OLCU_RANDEVU_BEKLIYOR': { label: 'Randevu Bekliyor', tone: 'warning', icon: '📅' },
  'OLCU_RANDEVULU': { label: 'Randevu Verildi', tone: 'info', icon: '📅' },
  'OLCU_ALINDI': { label: 'Ölçü Alındı', tone: 'success', icon: '📐' },
  'MUSTERI_OLCUSU_BEKLENIYOR': { label: 'Müşteri Ölçüsü Bekleniyor', tone: 'warning', icon: '📄' },
  'MUSTERI_OLCUSU_YUKLENDI': { label: 'Müşteri Ölçüsü Yüklendi', tone: 'success', icon: '✓' },
  // Fiyatlandırma statüleri
  'FIYATLANDIRMA': { label: 'Fiyat Verilecek', tone: 'secondary', icon: '💰' },
  'FIYAT_VERILDI': { label: 'Fiyat Verildi - Onay Bekliyor', tone: 'warning', icon: '⏳' },
  'ANLASILAMADI': { label: 'Anlaşılamadı', tone: 'danger', icon: '❌' },
  // Anlaşma statüleri
  'ANLASMA_YAPILIYOR': { label: 'Anlaşma Yapılıyor', tone: 'primary', icon: '📝' },
  'ANLASMA_TAMAMLANDI': { label: 'Anlaşma Tamamlandı', tone: 'success', icon: '✅' },
  // Stok/Rezervasyon statüleri
  'SONRA_URETILECEK': { label: 'Sonra Üretilecek', tone: 'info', icon: '📦' },
  // Üretim statüleri
  'URETIME_HAZIR': { label: 'Üretime Hazır', tone: 'success', icon: '✅' },
  'URETIMDE': { label: 'Üretimde', tone: 'primary', icon: '🔧' },
  // Montaj statüleri
  'MONTAJA_HAZIR': { label: 'Montaja Hazır', tone: 'success', icon: '✅' },
  'MONTAJ_TERMIN': { label: 'Montaj Terminli', tone: 'primary', icon: '🚚' },
  // Finans statüleri
  'MUHASEBE_BEKLIYOR': { label: 'Muhasebe Bekliyor', tone: 'secondary', icon: '💳' },
  'KAPALI': { label: 'Kapalı', tone: 'success', icon: '✓' },
  // Servis statüleri
  'SERVIS_RANDEVU_BEKLIYOR': { label: 'Servis Randevusu Bekliyor', tone: 'warning', icon: '🔧' },
  'SERVIS_RANDEVULU': { label: 'Servis Randevulu', tone: 'primary', icon: '📅' },
  'SERVIS_YAPILIYOR': { label: 'Servis Yapılıyor', tone: 'info', icon: '🛠️' },
  'SERVIS_DEVAM_EDIYOR': { label: 'Servis Devam Ediyor', tone: 'warning', icon: '🔄' },
  'SERVIS_ODEME_BEKLIYOR': { label: 'Servis Ödeme Bekliyor', tone: 'warning', icon: '💰' },
  'SERVIS_KAPALI': { label: 'Servis Tamamlandı', tone: 'success', icon: '✓' },
};

const renderStatus = (status) => {
  const statusInfo = STATUS_LABELS[status];
  if (statusInfo) {
    return (
      <span className={`badge badge-${statusInfo.tone}`}>
        {statusInfo.icon} {statusInfo.label}
      </span>
    );
  }
  
  // Fallback for unknown statuses
  const label = status || 'Bilinmiyor';
  const normalized = label.toLowerCase();

  let tone = 'secondary';
  if (normalized.includes('ölçü') || normalized.includes('olcu')) tone = 'primary';
  if (normalized.includes('fiyat')) tone = 'secondary';
  if (normalized.includes('teklif')) tone = 'secondary';
  if (normalized.includes('onay')) tone = 'warning';
  if (normalized.includes('stok')) tone = 'warning';
  if (normalized.includes('hazır') || normalized.includes('hazir')) tone = 'success';
  if (normalized.includes('anlaşma') || normalized.includes('anlasma')) tone = 'info';
  if (normalized.includes('üretim')) tone = 'warning';
  if (normalized.includes('montaj')) tone = 'primary';
  if (normalized.includes('muhasebe')) tone = 'secondary';
  if (normalized.includes('kapalı') || normalized.includes('kapali')) tone = 'success';
  if (normalized.includes('servis')) tone = 'info';

  return <span className={`badge badge-${tone}`}>{label}</span>;
};

const STAGE_FLOW = [
  { id: 'measure', label: 'Ölçü/Keşif', statuses: ['OLCU_RANDEVU_BEKLIYOR', 'OLCU_RANDEVULU', 'OLCU_ALINDI', 'MUSTERI_OLCUSU_BEKLENIYOR', 'MUSTERI_OLCUSU_YUKLENDI'] },
  { id: 'pricing', label: 'Fiyatlandırma', statuses: ['FIYATLANDIRMA', 'FIYAT_VERILDI', 'ANLASILAMADI'] },
  { id: 'agreement', label: 'Anlaşma', statuses: ['ANLASMA_YAPILIYOR'] },
  { id: 'stock', label: 'Stok/Rezervasyon', statuses: ['ANLASMA_TAMAMLANDI', 'SONRA_URETILECEK'] },
  { id: 'production', label: 'Üretim', statuses: ['URETIME_HAZIR', 'URETIMDE'] },
  { id: 'assembly', label: 'Montaj', statuses: ['MONTAJA_HAZIR', 'MONTAJ_TERMIN'] },
  { id: 'finance', label: 'Finans Kapanış', statuses: ['MUHASEBE_BEKLIYOR', 'KAPALI'] },
];

// Servis işleri için ayrı akış
const SERVICE_STAGE_FLOW = [
  { id: 'service_schedule', label: 'Randevu', statuses: ['SERVIS_RANDEVU_BEKLIYOR'] },
  { id: 'service_start', label: 'Başlat', statuses: ['SERVIS_RANDEVULU'] },
  { id: 'service_work', label: 'Servis', statuses: ['SERVIS_YAPILIYOR', 'SERVIS_DEVAM_EDIYOR'] },
  { id: 'service_payment', label: 'Ödeme', statuses: ['SERVIS_ODEME_BEKLIYOR'] },
  { id: 'service_done', label: 'Tamamlandı', statuses: ['SERVIS_KAPALI'] },
];

const findStageByStatus = (status) =>
  STAGE_FLOW.find((stage) => stage.statuses.includes(status)) || STAGE_FLOW[0];

// Bir aşamada geçilen durumları logs'tan çeken helper
const getStageHistory = (job, stageId) => {
  const stage = STAGE_FLOW.find(s => s.id === stageId) || SERVICE_STAGE_FLOW.find(s => s.id === stageId);
  if (!stage || !job.logs) return [];
  
  const stageStatuses = stage.statuses || [];
  const history = [];
  
  for (const log of job.logs) {
    if (log.action === 'status.updated' && log.note) {
      // "STATUS_A -> STATUS_B" formatından çıkar
      const match = log.note.match(/(\w+)\s*->\s*(\w+)/);
      if (match) {
        const [, fromStatus, toStatus] = match;
        if (stageStatuses.includes(fromStatus) || stageStatuses.includes(toStatus)) {
          history.push({
            from: fromStatus,
            to: toStatus,
            at: log.at,
            fromLabel: STATUS_LABELS[fromStatus]?.label || fromStatus,
            toLabel: STATUS_LABELS[toStatus]?.label || toStatus,
          });
        }
      }
    }
  }
  
  return history;
};

const getNextStage = (currentStageId) => {
  const idx = STAGE_FLOW.findIndex((s) => s.id === currentStageId);
  if (idx < 0 || idx >= STAGE_FLOW.length - 1) return null;
  return STAGE_FLOW[idx + 1];
};

const JobStepper = ({ job, customers = [], onUpdated }) => {
  // Müşteri detaylarını bul
  const customer = customers.find(c => c.id === job.customerId) || {};
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');
  const [stockItems, setStockItems] = useState([]);
  const [stockQuery, setStockQuery] = useState('');
  const [stockSkuQuery, setStockSkuQuery] = useState('');
  const [stockColorQuery, setStockColorQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState(null);
  const [reserveQty, setReserveQty] = useState(1);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [reservedLines, setReservedLines] = useState([]);
  const [qtyInputOpen, setQtyInputOpen] = useState(false);
  const [tempSelectedItem, setTempSelectedItem] = useState(null);
  const [tempQty, setTempQty] = useState(1);
  // Sonra Üret Modal
  const [sonraUretModalOpen, setSonraUretModalOpen] = useState(false);
  const [estimatedDate, setEstimatedDate] = useState('');
  const [productionNote, setProductionNote] = useState('');
  // Production Orders State
  const [productionOrders, setProductionOrders] = useState({ orders: [], summary: {} });
  const [productionOrdersLoading, setProductionOrdersLoading] = useState(false);
  const [showProdOrderModal, setShowProdOrderModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedProdOrder, setSelectedProdOrder] = useState(null);
  const [roleConfigs, setRoleConfigs] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [glassTypesList, setGlassTypesList] = useState([]);
  const [combinationsList, setCombinationsList] = useState([]);
  const [prodOrderForm, setProdOrderForm] = useState({
    roleId: '', roleName: '',
    // Üretim bilgileri
    productionType: 'internal',  // internal | external
    productionDescription: '',
    productionQty: 1,
    productionUnit: 'adet',
    productionEstDelivery: '',
    productionNotes: '',
    productionSupplierId: '',
    productionSupplierName: '',
    // Cam siparişi
    requiresGlass: false,
    includeGlass: false,
    glassItems: [{ glassType: '', glassName: '', quantity: 1, combination: '' }],
    glassSupplierId: '',
    glassSupplierName: '',
    glassEstDelivery: '',
  });
  const [deliveryFormData, setDeliveryFormData] = useState({ deliveries: [], deliveryDate: '', deliveryNote: '' });
  const [logs, setLogs] = useState([]);
  const [logsError, setLogsError] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [pendingPO, setPendingPO] = useState(job.pendingPO || []);
  const [inputs, setInputs] = useState({
    measureNote: '',
    appointment: '',
    measureCall: false,
    measureConfirmed: false,
    measureDraftFile: '',
    techDrawingFile: '',
    orderNo: '',
    cariCode: '',
    offerExpanded: true,
    offerTotal: '',
    pricingNotifiedDate: '', // Fiyat bildirim tarihi
    rejectionReason: '', // Ret açıklaması
    rejectionCategory: '', // Ret kategorisi
    rejectionFollowUp: '', // Takip tarihi
    showRejectionModal: false, // Ret modal göster
    // Pazarlık/İskonto
    roleDiscounts: {}, // İş kolu bazlı iskonto
    showNegotiationPanel: false, // Pazarlık paneli
    payCash: '',
    payCashDate: '', // Boşsa = bugün
    payCard: '',
    payCardDate: '', // Boşsa = bugün
    payAfter: '',
    payAfterNote: '', // Teslim sonrası için not
    chequeLines: [],
    chequesReceived: false, // Çekler teslim alındı mı?
    chequeCount: '', // Alınmadıysa adet
    chequeTotalAmount: '', // Alınmadıysa toplam tutar
    stockReady: true,
    stockNote: '',
    productionStatus: 'URETIMDE',
    agreementDate: '',
    assemblyDate: '',
    assemblyNote: '',
    assemblyTeam: '',
    proofNote: '',
    financeTotal: '',
    financeCash: '',
    financeCard: '',
    financeCheque: '',
    discountAmount: '',
    discountNote: '',
    // İş kolu bazlı fiyatlar
    rolePrices: {},
    // Servis alanları
    serviceAppointmentDate: '',
    serviceAppointmentTime: '10:00',
    serviceFixedFee: '',
    serviceNote: '',
    serviceVisitDate: '',
    serviceVisitTime: '',
    serviceWorkNote: '',
    serviceMaterials: '',
    serviceExtraCost: '',
    // Ödeme alanları
    servicePaymentCash: '',
    servicePaymentCard: '',
    servicePaymentTransfer: '',
    serviceDiscount: '',
    serviceDiscountNote: '',
    // Devam için yeni randevu
    serviceNewAppointmentDate: '',
    serviceNewAppointmentTime: '10:00',
    serviceNewAppointmentNote: '',
  });

  // Document upload state
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [jobDocuments, setJobDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  
  // Validasyon state'i
  const [validationErrors, setValidationErrors] = useState([]);
  
  // Aşama geçişi için validasyon fonksiyonu
  const validateStageTransition = (targetStage) => {
    const errors = [];
    
    if (targetStage === 'FIYATLANDIRMA') {
      // Müşteri ölçüsü ile başlatıldıysa dosya kontrolü
      if (job.startType === 'MUSTERI_OLCUSU') {
        if (job.roles?.length > 0) {
          job.roles.forEach((role) => {
            const roleKey = role.id || role.name;
            const roleFiles = job.roleFiles?.[roleKey] || {};
            if (!roleFiles.measure?.length) {
              errors.push(`${role.name} için ölçü çizimi yüklenmedi`);
            }
            if (!roleFiles.technical?.length) {
              errors.push(`${role.name} için teknik çizim yüklenmedi`);
            }
          });
        }
      }
      
      // Normal ölçü ile başlatıldıysa randevu kontrolü
      if (job.startType === 'OLCU' && !inputs.measureConfirmed) {
        errors.push('Ölçü randevusu onaylanmadı');
      }
    }
    
    if (targetStage === 'TEKLIF_HAZIR') {
      const rolePricesTotal = Object.values(inputs.rolePrices).reduce((sum, val) => sum + (Number(val) || 0), 0);
      const total = rolePricesTotal || Number(inputs.offerTotal || 0);
      if (!total || total <= 0) {
        errors.push('Teklif tutarı girilmedi');
      }
    }
    
    if (targetStage === 'ONAY_BEKLIYOR') {
      const planTotal = Number(inputs.payCash || 0) + Number(inputs.payCard || 0) + chequeTotal + Number(inputs.payAfter || 0);
      const offerTotal = Number(job.offer?.total || 0);
      if (Math.abs(planTotal - offerTotal) > 0.01) {
        errors.push(`Ödeme planı (${formatNumber(planTotal)} ₺) teklif tutarıyla (${formatNumber(offerTotal)} ₺) eşleşmiyor`);
      }
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Initialize inputs from job data
  useEffect(() => {
    const measure = job.measure || {};
    const offer = job.offer || {};
    const payments = job.payments || {};
    const assembly = job.assembly?.schedule || {};
    const finance = job.finance || {};

    setInputs((prev) => ({
      ...prev,
      // Measure
      measureNote: measure.note || '',
      appointment: measure.appointment || '',
      measureCall: measure.call || false,
      measureConfirmed: measure.confirm || false,
      // Pricing / Offer
      orderNo: offer.orderNo || '',
      cariCode: offer.cariCode || job.customerAccountCode || '',
      offerTotal: offer.total || '',
      // Payments
      payCash: payments.cash || '',
      payCard: payments.card || '',
      payCheque: payments.cheque || '',
      payAfter: payments.after || '',
      chequeLines: payments.chequeLines || [],
      // Production
      productionStatus: job.status === 'ANLASMADA' ? 'ANLASMADA' : (job.status === 'MONTAJA_HAZIR' ? 'MONTAJA_HAZIR' : 'URETIMDE'),
      agreementDate: job.agreementDate || '',
      // Assembly
      assemblyDate: assembly.date || '',
      assemblyNote: assembly.note || '',
      assemblyTeam: assembly.team || '',
      // Finance
      financeTotal: finance.total || offer.total || '',
      financeCash: finance.cash || payments.cash || '',
      // İş kolu bazlı fiyatlar
      rolePrices: job.rolePrices || {},
      // Servis alanları
      serviceAppointmentDate: job.service?.appointmentDate || '',
      serviceAppointmentTime: job.service?.appointmentTime || '10:00',
      serviceFixedFee: job.service?.fixedFee || '',
      serviceNote: job.service?.note || '',
      serviceWorkNote: job.service?.workNote || '',
      serviceMaterials: job.service?.materials || '',
      serviceExtraCost: job.service?.extraCost || '',
      serviceExtraNote: job.service?.extraNote || '',
      serviceCloseNote: job.service?.closeNote || '',
      financeCard: finance.card || payments.card || '',
      financeCheque: finance.cheque || payments.cheque || '',
      discountAmount: finance.discount || '',
      discountNote: finance.discountNote || '',
    }));
  }, [job]);

  // Servis işi mi kontrol et
  const isServiceJob = job.startType === 'SERVIS';
  
  // Akış seçimi - servis veya normal
  const activeFlow = isServiceJob ? SERVICE_STAGE_FLOW : STAGE_FLOW;
  
  const findStageByStatusForFlow = (status, flow) => {
    return flow.find((stage) => stage.statuses.includes(status)) || flow[0];
  };
  
  const currentStage = findStageByStatusForFlow(job.status || 'OLCU_RANDEVU_BEKLIYOR', activeFlow);
  const [selectedStage, setSelectedStage] = useState(currentStage.id);

  // Job değiştiğinde selectedStage'i güncelle
  useEffect(() => {
    const newStage = findStageByStatusForFlow(job.status || 'OLCU_RANDEVU_BEKLIYOR', activeFlow);
    setSelectedStage(newStage.id);
  }, [job.id, job.status, activeFlow]);

  const isStageSelected = (id) => selectedStage === id;
  const markStage = (id) => setSelectedStage(id);

  const stageState = (id) => {
    const currentIndex = activeFlow.findIndex((s) => s.id === currentStage.id);
    const index = activeFlow.findIndex((s) => s.id === id);
    if (index < currentIndex) return 'done';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

  // Salt okunur mod - seçilen aşama tamamlanmış (done) ise
  const selectedStageState = stageState(selectedStage);
  const isReadOnly = selectedStageState === 'done';

  const pushLog = async (action, detail, meta = {}) => {
    try {
      await addJobLog({ jobId: job.id, action, detail, meta });
      const fresh = await getJobLogs(job.id);
      setLogs(fresh);
    } catch (_) {
      // log errors are non-blocking
    }
  };

  // Load job documents
  const loadJobDocuments = async () => {
    try {
      setDocsLoading(true);
      const docs = await getJobDocuments(job.id);
      setJobDocuments(docs);
    } catch (_) {
      // Non-blocking
    } finally {
      setDocsLoading(false);
    }
  };

  // Auto-advance to next stage after successful action
  const advanceToNextStage = (updatedJob) => {
    const flow = updatedJob.startType === 'SERVIS' ? SERVICE_STAGE_FLOW : STAGE_FLOW;
    const newStage = findStageByStatusForFlow(updatedJob.status, flow);
    if (newStage.id !== currentStage.id) {
      setSelectedStage(newStage.id);
    }
  };

  // Check if should auto-advance
  const shouldAutoAdvance = (updatedJob, logMeta) => {
    if (logMeta?.skipAdvance) return false;
    // Always auto-advance to the next stage based on new status
    return true;
  };

  const act = async (fn, logMeta, options = {}) => {
    try {
      setActionLoading(true);
      setActionError('');
      const updated = await fn();
      const normalizedUpdated = normalizeJob(updated);
      onUpdated(normalizedUpdated);
      await pushLog('update', `Aşama: ${currentStage.label}`, { stage: currentStage.id, ...(logMeta || {}) });
      
      // Auto-advance to next stage if allowed
      if (shouldAutoAdvance(normalizedUpdated, logMeta)) {
        advanceToNextStage(normalizedUpdated);
      }
    } catch (err) {
      setActionError(toMessage(err) || 'İşlem başarısız');
    } finally {
      setActionLoading(false);
    }
  };

  // Document upload handler
  const handleDocUpload = async (file, docType, description = '') => {
    if (!file) return;
    try {
      setUploadingDoc(true);
      const doc = await uploadDocument(file, job.id, docType, description);
      setJobDocuments((prev) => [doc, ...prev]);
      return doc;
    } catch (err) {
      setActionError(err.message || 'Dosya yüklenemedi');
      return null;
    } finally {
      setUploadingDoc(false);
    }
  };

  // Document delete handler
  const handleDocDelete = async (docId) => {
    try {
      await deleteDocument(docId);
      setJobDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setActionError(err.message || 'Dosya silinemedi');
    }
  };

  const loadStock = async () => {
    try {
      setStockLoading(true);
      setStockError('');
      const payload = await getStockItems();
      const normalized = (payload || []).map((item) => ({
        ...item,
        available: Math.max(0, (item.onHand || 0) - (item.reserved || 0)),
      }));
      setStockItems(normalized);
    } catch (err) {
      setStockError(err.message || 'Stok listesi alınamadı');
    } finally {
      setStockLoading(false);
    }
  };

  // Production Data yükleme fonksiyonu (reusable) - her API ayrı try-catch
  const loadProductionData = async () => {
    setProductionOrdersLoading(true);
    
    // Her API'yi ayrı ayrı çağır - birisi hata verse diğerleri çalışsın
    let ordersData = { orders: [], summary: {} };
    let rolesData = [];
    let suppliersData = [];
    let glassData = [];
    let combData = [];
    
    try {
      ordersData = await getProductionOrdersByJob(job.id);
    } catch (err) {
      console.warn('Orders load error:', err);
    }
    
    try {
      rolesData = await getJobRolesConfig(true);
    } catch (err) {
      console.warn('Roles load error:', err);
    }
    
    try {
      suppliersData = await getSuppliersFromAPI();
    } catch (err) {
      console.warn('Suppliers load error:', err);
    }
    
    try {
      glassData = await getGlassTypes();
    } catch (err) {
      console.warn('Glass types load error:', err);
    }
    
    try {
      combData = await getProductionCombinations();
    } catch (err) {
      console.warn('Combinations load error:', err);
    }
    
    setProductionOrders(ordersData || { orders: [], summary: {} });
    setRoleConfigs(rolesData || []);
    setSuppliersList(suppliersData || []);
    setGlassTypesList(glassData || []);
    setCombinationsList(combData || []);
    setProductionOrdersLoading(false);
    
    return { ordersData, rolesData, suppliersData, glassData, combData };
  };

  useEffect(() => {
    loadStock();
    loadJobDocuments();
    const loadLogs = async () => {
      try {
        setLogsError('');
        const payload = await getJobLogs(job.id);
        setLogs(payload);
      } catch (err) {
        setLogsError(err.message || 'Loglar alınamadı');
      }
    };
    loadLogs();
    setPendingPO(job.pendingPO || []);
    loadProductionData();
  }, [job?.id]);

  const stockStatus = (item) => {
    if (!item) return { label: '-', tone: 'secondary' };
    if (item.available <= 0) return { label: 'Tükendi', tone: 'danger' };
    if (item.available <= item.critical) return { label: 'Kritik', tone: 'danger' };
    if (item.available <= item.critical + Math.max(5, item.critical * 0.25)) return { label: 'Düşük', tone: 'warning' };
    return { label: 'Sağlıklı', tone: 'success' };
  };

  const filteredStock = useMemo(() => {
    const q = stockQuery.trim().toLowerCase();
    const skuQ = stockSkuQuery.trim().toLowerCase();
    const colorQ = stockColorQuery.trim().toLowerCase();
    let result = stockItems;
    
    if (q) {
      result = result.filter(
        (it) =>
          (it.name || '').toLowerCase().includes(q) ||
          (it.supplierName || it.supplier || '').toLowerCase().includes(q) ||
          (it.colorName || '').toLowerCase().includes(q)
      );
    }
    
    // Ürün kodu ile filtreleme (productCode veya sku)
    if (skuQ) {
      result = result.filter((it) => (it.productCode || it.sku || '').toLowerCase().includes(skuQ));
    }
    
    // Renk kodu ile filtreleme
    if (colorQ) {
      result = result.filter((it) => (it.colorCode || it.color || '').toLowerCase().includes(colorQ));
    }
    
    return result;
  }, [stockItems, stockQuery, stockSkuQuery, stockColorQuery]);

  const stockSummary = useMemo(() => {
    const total = stockItems.reduce((sum, it) => sum + (it.available || 0), 0);
    const critical = stockItems.filter((it) => stockStatus(it).tone !== 'success').length;
    return { total, critical };
  }, [stockItems]);

  const offerTotalValue = useMemo(() => {
    const fromJob = Number(job.offer?.total || 0);
    const local = Number(inputs.offerTotal || 0);
    return local || fromJob || 0;
  }, [job.offer, inputs.offerTotal]);

  const chequeTotal = useMemo(
    () => {
      // Çekler alındıysa chequeLines toplamı, alınmadıysa chequeTotalAmount kullan
      if (inputs.chequesReceived && inputs.chequeLines?.length > 0) {
        return (inputs.chequeLines || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
      }
      return Number(inputs.chequeTotalAmount || 0);
    },
    [inputs.chequeLines, inputs.chequesReceived, inputs.chequeTotalAmount]
  );

  const paymentTotal = useMemo(() => {
    return (
      Number(inputs.payCash || 0) +
      Number(inputs.payCard || 0) +
      chequeTotal +
      Number(inputs.payAfter || 0)
    );
  }, [inputs.payCash, inputs.payCard, inputs.payAfter, chequeTotal]);

  // Toleranslı karşılaştırma (floating point hataları için)
  const isPaymentMatch = useMemo(() => {
    return Math.abs(paymentTotal - offerTotalValue) < 0.01;
  }, [paymentTotal, offerTotalValue]);

  const avgChequeDays = useMemo(() => {
    const lines = inputs.chequeLines || [];
    if (lines.length === 0) return 0;
    const today = new Date();
    const totalAmount = lines.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    if (totalAmount <= 0) return 0;
    const weighted = lines.reduce((sum, c) => {
      const due = c.due ? new Date(c.due) : today;
      const days = Math.max(0, Math.round((due - today) / (1000 * 60 * 60 * 24)));
      return sum + Number(c.amount || 0) * days;
    }, 0);
    return Math.round(weighted / totalAmount);
  }, [inputs.chequeLines]);

  const selectStock = (item) => {
    setSelectedStock(item);
    setReserveQty(1);
  };

  // Yeni: Hızlı seçim için ürün tıklandığında miktar popup'ı aç
  const openQtyInput = (item) => {
    // Zaten eklenmişse ekleme
    if (reservedLines.some((l) => l.id === item.id)) return;
    setTempSelectedItem(item);
    setTempQty(1);
    setQtyInputOpen(true);
  };

  // Yeni: Miktar popup'ından sepete ekle
  const addFromQtyInput = () => {
    if (!tempSelectedItem || tempQty <= 0) return;
    
    const newLine = {
      id: tempSelectedItem.id,
      name: tempSelectedItem.name,
      productCode: tempSelectedItem.productCode || tempSelectedItem.sku,
      colorCode: tempSelectedItem.colorCode || tempSelectedItem.color,
      sku: tempSelectedItem.sku || tempSelectedItem.productCode,
      qty: tempQty,
      unit: tempSelectedItem.unit || 'adet',
      available: tempSelectedItem.available,
      onHand: tempSelectedItem.onHand,
      reserved: tempSelectedItem.reserved || 0,
      supplier: tempSelectedItem.supplier || tempSelectedItem.supplierName,
      color: tempSelectedItem.color || tempSelectedItem.colorName,
      colorName: tempSelectedItem.colorName,
    };
    
    setReservedLines((prev) => [...prev, newLine]);
    setQtyInputOpen(false);
    setTempSelectedItem(null);
    setTempQty(1);
    // Aramayı temizle
    setStockQuery('');
    setStockSkuQuery('');
    setStockColorQuery('');
  };

  const addReservedLine = () => {
    if (!selectedStock || reserveQty <= 0) return;
    
    const newLine = {
      id: selectedStock.id,
      name: selectedStock.name,
      productCode: selectedStock.productCode || selectedStock.sku,
      colorCode: selectedStock.colorCode || selectedStock.color,
      sku: selectedStock.sku || selectedStock.productCode,
      qty: reserveQty,
      unit: selectedStock.unit || 'adet',
      available: selectedStock.available,
      onHand: selectedStock.onHand,
      reserved: selectedStock.reserved || 0,
      supplier: selectedStock.supplier || selectedStock.supplierName,
      color: selectedStock.color || selectedStock.colorName,
      colorName: selectedStock.colorName,
    };
    
    setReservedLines((prev) => {
      const existing = prev.find((line) => line.id === selectedStock.id);
      if (existing) {
        return prev.map((line) =>
          line.id === selectedStock.id ? { ...line, qty: line.qty + reserveQty } : line
        );
      }
      return [...prev, newLine];
    });
    
    // Feedback: seçimi temizle ama modal açık kalsın
    setSelectedStock(null);
    setReserveQty(1);
    // Modal açık kalır - birden fazla ürün eklenebilir
  };

  const removeLine = (id) => {
    setReservedLines((prev) => prev.filter((line) => line.id !== id));
  };

  const status = job.status || '';

  return (
    <div className="grid grid-1" style={{ gap: 16 }}>
      <div className="card subtle-card">
        <div className="card-header">
          <h3 className="card-title">Süreç Haritası</h3>
          <span className="badge badge-secondary">{currentStage.label}</span>
        </div>
        <div className="card-body" style={{ overflowX: 'auto', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content', padding: '0 12px' }}>
            {activeFlow.map((stage, idx) => {
              const state = stageState(stage.id);
              const isActive = state === 'current';
              const isDone = state === 'done';
              const isLast = idx === activeFlow.length - 1;
              
              // Alt aşama sayısı (noktalar için)
              const subStepCount = stage.statuses?.length || 1;
              // Mevcut durum bu aşamada mı ve kaçıncı alt adımda
              const currentSubIndex = isActive 
                ? stage.statuses?.indexOf(job.status) 
                : isDone ? subStepCount : -1;

              let color = '#e2e8f0'; // gray-200
              if (isActive) color = '#3b82f6'; // blue-500
              if (isDone) color = '#22c55e'; // green-500

              return (
                <div key={stage.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 1,
                      width: 100,
                    }}
                    onClick={() => markStage(stage.id)}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: isActive ? 'white' : color,
                        border: `2px solid ${color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: isActive ? color : 'white',
                        marginBottom: 8,
                        transition: 'all 0.2s',
                        boxShadow: isActive ? `0 0 0 4px ${color}33` : 'none',
                      }}
                    >
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#0f172a' : '#64748b',
                        textAlign: 'center',
                        lineHeight: 1.3,
                      }}
                    >
                      {stage.label}
                    </div>
                  </div>
                  {/* Bağlantı çizgisi ve ara noktalar */}
                  {!isLast && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      position: 'relative',
                      marginTop: -20 // Label'ın üstünde kalması için
                    }}>
                      {/* Ana çizgi */}
                    <div
                      style={{
                          width: subStepCount > 1 ? 30 + (subStepCount - 1) * 16 : 60,
                        height: 3,
                        backgroundColor: isDone ? '#22c55e' : '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-evenly',
                          position: 'relative'
                        }}
                      >
                        {/* Alt adım noktaları - sadece 2'den fazla alt adım varsa göster */}
                        {subStepCount > 1 && Array.from({ length: subStepCount - 1 }).map((_, dotIdx) => {
                          const dotDone = isDone || (isActive && dotIdx < currentSubIndex);
                          return (
                            <div
                              key={dotIdx}
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: dotDone ? '#22c55e' : (isActive && dotIdx === currentSubIndex ? '#3b82f6' : '#cbd5e1'),
                                border: isActive && dotIdx === currentSubIndex ? '2px solid #3b82f6' : 'none',
                                boxShadow: isActive && dotIdx === currentSubIndex ? '0 0 0 2px rgba(59,130,246,0.3)' : 'none',
                                transition: 'all 0.2s'
                              }}
                              title={stage.statuses?.[dotIdx + 1] ? STATUS_LABELS[stage.statuses[dotIdx + 1]]?.label || '' : ''}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="card-footer text-muted">
          Seçtiğiniz aşamanın formu aşağıda açılır. Önceki aşamalara dönüp düzeltme yapabilirsiniz.
        </div>
      </div>

      <div className="card subtle-card" style={{ marginBottom: 16 }}>
        <div className="grid grid-2" style={{ gap: 16 }}>
          <div>
            <div className="metric-row" style={{ marginBottom: 8 }}>
          <span className="metric-label">Durum</span>
              {renderStatus(job.status)}
        </div>
            <div className="metric-row" style={{ marginBottom: 8 }}>
          <span className="metric-label">Başlık</span>
          <span className="metric-value">{job.title}</span>
        </div>
        <div className="metric-row">
              <span className="metric-label">İş No</span>
              <span className="metric-value" style={{ fontSize: 12 }}>{job.id}</span>
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>👤 {job.customerName}</div>
            {customer.phone && (
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                📞 {customer.phone}
                {customer.phone2 && ` / ${customer.phone2}`}
              </div>
            )}
            {customer.address && (
              <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                📍 {customer.address}
              </div>
            )}
            {!customer.phone && !customer.address && (
              <div className="text-muted" style={{ fontSize: 12 }}>Müşteri detayları bulunamadı</div>
            )}
          </div>
        </div>
      </div>

      {actionError ? (
        <div className="card error-card">
          <div className="error-title">Hata</div>
          <div className="error-message">{actionError}</div>
        </div>
      ) : null}

      {isStageSelected('measure') && (
        <div className="card">
          {/* Salt Okunur Banner */}
          {isReadOnly && (() => {
            const history = getStageHistory(job, 'measure');
            return (
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderBottom: '1px solid var(--color-border)',
                padding: '12px 16px',
                color: '#475569'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: history.length > 0 ? 10 : 0 }}>
                  <span style={{ fontSize: 18 }}>📂</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Arşiv Görünümü</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Bu aşama tamamlandı. Sadece görüntüleme modundasınız.</div>
                  </div>
                </div>
                {history.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#64748b' }}>📍 Geçilen Alt Aşamalar:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {history.map((h, idx) => (
                        <span key={idx} className="badge badge-secondary" style={{ fontSize: 10 }}>
                          {h.toLabel} • {new Date(h.at).toLocaleDateString('tr-TR')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="card-header">
            <h3 className="card-title">
              {job.startType === 'MUSTERI_OLCUSU' ? '📄 Müşteri Ölçüsü' : '📐 Ölçü / Keşif'}
            </h3>
            {renderStatus(job.status)}
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            
            {/* İş Kolu Bilgisi */}
            {job.roles?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {job.roles.map((r) => (
                  <span key={r.id || r.name} className="badge badge-secondary">{r.name}</span>
                ))}
              </div>
            )}

            {/* SALT OKUNUR MOD - Özet Görünümü */}
            {isReadOnly && (
              <div className="card subtle-card" style={{ background: '#f8fafc' }}>
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📋 Ölçü Bilgileri Özeti</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>RANDEVU TARİHİ</div>
                      <div style={{ fontWeight: 600 }}>
                        {job.measure?.appointment?.date 
                          ? new Date(job.measure.appointment.date).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                      <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                    </div>
                  </div>
                  {job.measure?.measurements?.note && (
                    <div style={{ marginBottom: 16, padding: 12, background: 'white', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                      <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>NOT</div>
                      <div>{job.measure.measurements.note}</div>
                    </div>
                  )}
                  
                  {/* Yüklü Dosyalar */}
                  {jobDocuments.length > 0 && (
                    <div>
                      <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>📁 YÜKLÜ DOSYALAR</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {jobDocuments.map((doc) => (
                          <div key={doc.id} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '10px 12px',
                            background: 'white',
                            borderRadius: 6,
                            border: '1px solid var(--color-border)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>📄</span>
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 13 }}>{doc.fileName || doc.filename}</div>
                                <div className="text-muted" style={{ fontSize: 11 }}>{doc.type}</div>
                              </div>
                            </div>
                            <a 
                              href={`http://localhost:8000/documents/${doc.id}/download`}
                              className="btn btn-sm"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              download
                            >
                              ⬇️ İndir
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AŞAMA 1: RANDEVU BEKLİYOR */}
            {!isReadOnly && job.status === 'OLCU_RANDEVU_BEKLIYOR' && job.startType !== 'MUSTERI_OLCUSU' && (
              <div className="card subtle-card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📅 Randevu Bilgileri</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="grid grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                      <label className="form-label">Randevu Tarihi *</label>
                <input
                  className="form-input"
                  type="date"
                  value={inputs.appointment?.split('T')[0] || ''}
                  onChange={(e) => {
                    const time = inputs.appointment?.includes('T') ? inputs.appointment.split('T')[1]?.slice(0, 5) : '10:00';
                    setInputs((p) => ({ ...p, appointment: e.target.value ? `${e.target.value}T${time}` : '' }));
                  }}
                />
              </div>
              <div className="form-group">
                      <label className="form-label">Saat *</label>
                <input
                  className="form-input"
                  type="time"
                  value={inputs.appointment?.includes('T') ? inputs.appointment.split('T')[1]?.slice(0, 5) : '10:00'}
                  onChange={(e) => {
                    const date = inputs.appointment?.split('T')[0] || '';
                    if (date) {
                      setInputs((p) => ({ ...p, appointment: `${date}T${e.target.value}` }));
                    }
                  }}
                />
              </div>
              </div>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label">Adres / Not</label>
            <textarea
              className="form-textarea"
                      placeholder="Müşteri adresi, iletişim bilgileri, notlar..."
                      rows={2}
              value={inputs.measureNote}
              onChange={(e) => setInputs((p) => ({ ...p, measureNote: e.target.value }))}
            />
                  </div>
            <button
                    className="btn btn-success"
              type="button"
                    style={{ marginTop: 12 }}
                    disabled={actionLoading || !inputs.appointment}
              onClick={() =>
                  act(
                    () =>
                  updateJobMeasure(job.id, {
                            measurements: { note: inputs.measureNote },
                            appointment: { date: inputs.appointment },
                            status: 'OLCU_RANDEVULU',
                          }),
                        { transition: 'OLCU_RANDEVULU' }
                      )
                    }
                  >
                    ✓ Randevuyu Kaydet
              </button>
                  {!inputs.appointment && (
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                      ⚠️ Randevu tarihi zorunludur.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AŞAMA 2: RANDEVU VERİLDİ - Ölçüye gidilecek */}
            {!isReadOnly && job.status === 'OLCU_RANDEVULU' && (
              <div className="card" style={{ border: '2px solid var(--color-info)', background: 'var(--color-info-bg)' }}>
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📅 Randevu Bilgisi</h4>
                  <span className="badge badge-info">Ölçüye Gidilecek</span>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="grid grid-2" style={{ gap: 16 }}>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>RANDEVU</div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>
                        {job.measure?.appointment?.date ? 
                          new Date(job.measure.appointment.date).toLocaleString('tr-TR', { 
                            dateStyle: 'long', 
                            timeStyle: 'short' 
                          }) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                      <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                    </div>
                  </div>
                  {job.measure?.measurements?.note && (
                    <div style={{ marginTop: 12, padding: 10, background: 'white', borderRadius: 6 }}>
                      <strong>Not:</strong> {job.measure.measurements.note}
                    </div>
                  )}
              <button
                    className="btn btn-primary"
                type="button"
                    style={{ marginTop: 16 }}
                disabled={actionLoading}
                onClick={() =>
                  act(
                    () =>
                          updateJobStatus(job.id, { status: 'OLCU_ALINDI' }),
                        { transition: 'OLCU_ALINDI' }
                      )
                    }
                  >
                    🚗 Ölçü Alındı - Dosya Yüklemeye Geç
            </button>
          </div>
        </div>
      )}

            {/* AŞAMA 3: ÖLÇÜ ALINDI - Dosya yükleme */}
            {!isReadOnly && (job.status === 'OLCU_ALINDI' || job.startType === 'MUSTERI_OLCUSU') && job.roles?.length > 0 && (
              <div className="card subtle-card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📁 Çizim Dosyaları</h4>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    Her iş kolu için dosya yükleyin
                  </span>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  {job.roles.map((role) => {
                    const roleKey = role.id || role.name;
                    // jobDocuments'tan dosya kontrolü
                    const measureDocs = jobDocuments.filter(d => d.type === `measure_${roleKey}`);
                    const techDocs = jobDocuments.filter(d => d.type === `technical_${roleKey}`);
                    const hasMeasureFile = measureDocs.length > 0;
                    const hasTechFile = techDocs.length > 0;
                    const isComplete = hasMeasureFile && hasTechFile;
                    
                    return (
                      <div key={roleKey} style={{ 
                        marginBottom: 16, 
                        padding: 16, 
                        background: isComplete ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)',
                        borderRadius: 8,
                        border: isComplete ? '1px solid var(--color-success)' : '1px solid var(--color-border)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isComplete && <span style={{ color: 'var(--color-success)' }}>✓</span>}
                            {role.name}
                          </div>
                          {isComplete && <span className="badge badge-success">Tamamlandı</span>}
                        </div>
                        <div className="grid grid-2" style={{ gap: 12 }}>
                    <div className="form-group">
                            <label className="form-label">
                              Ölçü Çizimi {!hasMeasureFile && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                            </label>
                      <div className="file-upload-zone">
                        <input
                          type="file"
                                id={`measure-file-${roleKey}`}
                                accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                    await handleDocUpload(file, `measure_${roleKey}`, `${role.name} - Ölçü Çizimi`);
                              e.target.value = '';
                            }
                          }}
                        />
                              <label htmlFor={`measure-file-${roleKey}`} className="btn btn-secondary btn-small" style={{ cursor: 'pointer' }}>
                                📐 Dosya Seç
                        </label>
                              {hasMeasureFile && <span className="badge badge-success" style={{ marginLeft: 8 }}>✓</span>}
                      </div>
                            {/* Yüklü dosyalar */}
                            {measureDocs.map(doc => (
                              <div key={doc.id} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <a
                            href={getDocumentDownloadUrl(doc.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                                  style={{ color: 'var(--color-primary)' }}
                          >
                            📎 {doc.originalName}
                          </a>
                          <button
                            type="button"
                            className="btn btn-danger btn-small btn-icon"
                                  style={{ padding: '2px 6px', fontSize: 10 }}
                            onClick={() => handleDocDelete(doc.id)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="form-group">
                            <label className="form-label">
                              Teknik Çizim {!hasTechFile && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                            </label>
                      <div className="file-upload-zone">
                        <input
                          type="file"
                                id={`tech-file-${roleKey}`}
                                accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                    await handleDocUpload(file, `technical_${roleKey}`, `${role.name} - Teknik Çizim`);
                              e.target.value = '';
                            }
                          }}
                        />
                              <label htmlFor={`tech-file-${roleKey}`} className="btn btn-secondary btn-small" style={{ cursor: 'pointer' }}>
                                📏 Dosya Seç
                        </label>
                              {hasTechFile && <span className="badge badge-success" style={{ marginLeft: 8 }}>✓</span>}
                      </div>
                            {/* Yüklü dosyalar */}
                            {techDocs.map(doc => (
                              <div key={doc.id} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <a
                            href={getDocumentDownloadUrl(doc.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                                  style={{ color: 'var(--color-primary)' }}
                          >
                            📎 {doc.originalName}
                          </a>
                          <button
                            type="button"
                            className="btn btn-danger btn-small btn-icon"
                                  style={{ padding: '2px 6px', fontSize: 10 }}
                            onClick={() => handleDocDelete(doc.id)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                    );
                  })}
                  
                  {/* Uyarı veya geçiş butonu */}
                  {(() => {
                    const allComplete = job.roles.every((role) => {
                      const roleKey = role.id || role.name;
                      const hasMeasure = jobDocuments.some(d => d.type === `measure_${roleKey}`);
                      const hasTech = jobDocuments.some(d => d.type === `technical_${roleKey}`);
                      return hasMeasure && hasTech;
                    });
                    
                    if (!allComplete) {
                      return (
                        <div className="text-muted" style={{ 
                          padding: 12, 
                          background: 'var(--color-warning-bg)', 
                          borderRadius: 8,
                          fontSize: 13
                        }}>
                          ⚠️ Fiyatlandırmaya geçmek için tüm iş kollarının dosyaları yüklenmelidir.
              </div>
                      );
                    }
                    
                    return (
                      <button
                        className="btn btn-success"
                        type="button"
                        style={{ marginTop: 8 }}
                        disabled={actionLoading}
                        onClick={() =>
                          act(
                            () =>
                              updateJobStatus(job.id, { status: 'FIYATLANDIRMA' }),
                            { transition: 'FIYATLANDIRMA' }
                          )
                        }
                      >
                        ✓ Fiyatlandırmaya Geç
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Müşteri Ölçüsü - Dosya bekleniyor */}
            {job.status === 'MUSTERI_OLCUSU_BEKLENIYOR' && (
              <div className="card" style={{ border: '2px solid var(--color-warning)', background: 'var(--color-warning-bg)' }}>
                <div className="card-body" style={{ padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Müşteri Ölçüsü Bekleniyor</div>
                  <div className="text-muted">Yukarıdaki alanlara müşteriden gelen ölçü dosyalarını yükleyin.</div>
                </div>
              </div>
            )}

            {/* Validasyon Hataları */}
            {validationErrors.length > 0 && (
              <div className="card error-card">
                <div className="error-title">⚠️ Eksikler var</div>
                <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                  {validationErrors.map((err, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {isStageSelected('pricing') && (
        <div className="card">
          {/* Salt Okunur Banner */}
          {isReadOnly && (() => {
            const history = getStageHistory(job, 'pricing');
            return (
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderBottom: '1px solid var(--color-border)',
                padding: '12px 16px',
                color: '#475569'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: history.length > 0 ? 10 : 0 }}>
                  <span style={{ fontSize: 18 }}>📂</span>
                <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Arşiv Görünümü</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Bu aşama tamamlandı. Sadece görüntüleme modundasınız.</div>
                </div>
                </div>
                {history.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#64748b' }}>📍 Geçilen Alt Aşamalar:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {history.map((h, idx) => (
                        <span key={idx} className="badge badge-secondary" style={{ fontSize: 10 }}>
                          {h.toLabel} • {new Date(h.at).toLocaleDateString('tr-TR')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="card-header">
            <h3 className="card-title">💰 Fiyatlandırma</h3>
            {renderStatus(job.status)}
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            
            {/* SALT OKUNUR MOD - Fiyatlandırma Özeti */}
            {isReadOnly && (
              <div className="card subtle-card" style={{ background: '#f8fafc' }}>
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📋 Fiyatlandırma Özeti</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  {/* İş Kolu Fiyatları */}
                  {job.offer?.rolePrices && Object.keys(job.offer.rolePrices).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>İŞ KOLU FİYATLARI</div>
                      {job.roles?.map((role) => {
                        const roleKey = role.id || role.name;
                        const price = job.offer.rolePrices?.[roleKey] || 0;
                        return (
                          <div key={roleKey} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: 'white',
                            borderRadius: 6,
                            marginBottom: 4,
                            border: '1px solid var(--color-border)'
                          }}>
                            <span>{role.name}</span>
                            <span style={{ fontWeight: 600 }}>{formatNumber(price)} ₺</span>
                          </div>
                        );
                      })}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '12px',
                        background: 'var(--color-primary-bg)',
                        borderRadius: 6,
                        marginTop: 8
                      }}>
                        <span style={{ fontWeight: 600 }}>TOPLAM</span>
                        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                          {formatNumber(job.offer?.total || 0)} ₺
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Bildirim Tarihi */}
                  {job.offer?.notifiedDate && (
                    <div style={{ marginBottom: 16 }}>
                      <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>FİYAT BİLDİRİM TARİHİ</div>
                      <div style={{ fontWeight: 500 }}>
                        {new Date(job.offer.notifiedDate).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                  )}
                  
                  {/* Yüklü Dosyalar */}
                  {jobDocuments.length > 0 && (
                <div>
                      <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>📁 YÜKLÜ DOSYALAR</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {jobDocuments.map((doc) => (
                          <a 
                            key={doc.id}
                            href={getDocumentDownloadUrl(doc.id)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-sm"
                            style={{ fontSize: 11 }}
                          >
                            📎 {doc.originalName} ⬇️
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* FIYATLANDIRMA - Fiyat girilecek */}
            {!isReadOnly && job.status === 'FIYATLANDIRMA' && (
              <>
                {/* Yüklü Dosyalar */}
                {jobDocuments.length > 0 && (
                  <div className="card subtle-card">
                    <div className="card-header" style={{ padding: '12px 16px' }}>
                      <h4 className="card-title" style={{ fontSize: 14 }}>📁 Yüklü Dosyalar</h4>
                    </div>
                    <div className="card-body" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {jobDocuments.map((doc) => (
                          <a 
                            key={doc.id}
                            href={getDocumentDownloadUrl(doc.id)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              padding: '6px 12px', 
                              background: 'var(--color-bg-secondary)', 
                              borderRadius: 6,
                              fontSize: 12,
                              textDecoration: 'none',
                              color: 'var(--color-text)'
                            }}
                          >
                            📎 {doc.originalName}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* İş Kolu Bazlı Fiyatlandırma */}
                {job.roles?.length > 0 && (
                  <div className="card subtle-card">
                    <div className="card-header" style={{ padding: '12px 16px' }}>
                      <h4 className="card-title" style={{ fontSize: 14 }}>💰 İş Kolu Bazlı Fiyatlandırma</h4>
                    </div>
                    <div className="card-body" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {job.roles.map((role) => {
                          const roleKey = role.id || role.name;
                          return (
                            <div key={roleKey} className="metric-row" style={{ 
                              padding: '12px 16px', 
                              background: 'var(--color-bg-secondary)',
                              borderRadius: 8
                            }}>
                              <div style={{ fontWeight: 600, minWidth: 180 }}>{role.name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CurrencyInput
                                  placeholder="0"
                                  style={{ width: 150 }}
                                  value={inputs.rolePrices[roleKey] || ''}
                                  onChange={(val) => setInputs((p) => ({
                                    ...p,
                                    rolePrices: { ...p.rolePrices, [roleKey]: val }
                                  }))}
                                />
                                <span style={{ color: 'var(--color-text-light)' }}>₺</span>
                </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Toplam */}
                      <div style={{ 
                        marginTop: 16, 
                        padding: '16px', 
                        background: 'var(--color-primary)', 
                        borderRadius: 8,
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontWeight: 600 }}>TOPLAM</span>
                        <span style={{ fontSize: 24, fontWeight: 700 }}>
                          {formatNumber(
                            Object.values(inputs.rolePrices).reduce((sum, val) => sum + (Number(val) || 0), 0)
                          )} ₺
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fiyat Bildirimi */}
                <div className="card subtle-card">
                  <div className="card-header" style={{ padding: '12px 16px' }}>
                    <h4 className="card-title" style={{ fontSize: 14 }}>📞 Müşteriye Bildirim</h4>
                  </div>
                  <div className="card-body" style={{ padding: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Fiyat Bildirim Tarihi *</label>
                  <input
                    className="form-input"
                        type="date"
                        value={inputs.pricingNotifiedDate || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setInputs((p) => ({ ...p, pricingNotifiedDate: e.target.value }))}
                  />
                </div>
                    <button
                      className="btn btn-success"
                      type="button"
                      style={{ marginTop: 12 }}
                      disabled={actionLoading || Object.values(inputs.rolePrices).every(v => !v)}
                      onClick={() => {
                        const total = Object.values(inputs.rolePrices).reduce((sum, val) => sum + (Number(val) || 0), 0);
                        act(
                          () =>
                            updateJobStatus(job.id, {
                              status: 'FIYAT_VERILDI',
                              offer: {
                                total,
                                rolePrices: inputs.rolePrices,
                                notifiedDate: inputs.pricingNotifiedDate || new Date().toISOString().split('T')[0],
                              },
                            }),
                          { transition: 'FIYAT_VERILDI' }
                        );
                      }}
                    >
                      ✓ Fiyat Müşteriye Bildirildi
                    </button>
              </div>
                </div>
              </>
            )}

            {/* FIYAT_VERILDI - Müşteri onayı bekleniyor */}
            {!isReadOnly && job.status === 'FIYAT_VERILDI' && (() => {
              // Hesaplamalar - job.roles üzerinden fiyatları al
              const rolePrices = job.offer?.rolePrices || {};
              const originalTotal = job.offer?.total || job.roles?.reduce((sum, role) => {
                const roleKey = role.id || role.name;
                return sum + (Number(rolePrices[roleKey]) || 0);
              }, 0) || 0;
              const currentDiscounts = inputs.roleDiscounts || {};
              const totalDiscount = Object.values(currentDiscounts).reduce((sum, val) => sum + (Number(val) || 0), 0);
              const finalTotal = originalTotal - totalDiscount;
              const hasNegotiation = job.offer?.negotiationHistory?.length > 0;
              
              return (
              <>
                {/* Fiyat Özeti */}
                <div className="card" style={{ border: '2px solid var(--color-warning)', background: 'var(--color-warning-bg)' }}>
                  <div className="card-body" style={{ padding: 20 }}>
                    <div className="grid grid-3" style={{ gap: 16, marginBottom: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div className="text-muted" style={{ fontSize: 12 }}>İLK FİYAT</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: originalTotal > 0 ? 'var(--color-text)' : 'var(--color-danger)' }}>
                          {originalTotal > 0 ? `${formatNumber(originalTotal)} ₺` : 'Fiyat Girilmedi!'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div className="text-muted" style={{ fontSize: 12 }}>BİLDİRİM TARİHİ</div>
                        <div style={{ fontWeight: 600 }}>
                          {job.offer?.notifiedDate ? new Date(job.offer.notifiedDate).toLocaleDateString('tr-TR') : '-'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                        <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                      </div>
                    </div>
                    
                    {/* İş kolu detayları - job.roles üzerinden */}
                    {job.roles?.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 8 }}>İş Kolu Bazlı Fiyatlar:</div>
                        {job.roles.map((role) => {
                          const roleKey = role.id || role.name;
                          const price = Number(rolePrices[roleKey]) || 0;
                          return (
                            <div key={roleKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                              <span>{role.name}</span>
                              <span style={{ color: price > 0 ? 'inherit' : 'var(--color-danger)' }}>
                                {price > 0 ? `${formatNumber(price)} ₺` : 'Girilmedi'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fiyat girilmemişse uyarı ve düzeltme */}
                {originalTotal === 0 && (
                  <div className="card" style={{ border: '2px solid var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                    <div className="card-body" style={{ padding: 16 }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8 }}>
                        ⚠️ Bu iş için fiyat girilmemiş!
                      </div>
                      <div className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
                        Fiyatlandırma aşamasına geri dönüp iş kolu bazlı fiyatları girmeniz gerekmektedir.
                      </div>
                      <button
                        className="btn btn-warning"
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          act(
                            () => updateJobStatus(job.id, { status: 'FIYATLANDIRMA' }),
                            { transition: 'FIYATLANDIRMA' }
                          )
                        }
                      >
                        ← Fiyatlandırmaya Geri Dön
                      </button>
                    </div>
                  </div>
                )}

                {/* Pazarlık ve Fiyat Geçmişi - Her zaman görünür */}
                <div className="card subtle-card">
                  <div className="card-header" style={{ padding: '12px 16px' }}>
                    <h4 className="card-title" style={{ fontSize: 14 }}>📜 Fiyat Geçmişi</h4>
                  </div>
                  <div className="card-body" style={{ padding: hasNegotiation ? 0 : 16 }}>
                    {hasNegotiation ? (
                      <table className="table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Tarih</th>
                            <th>İlk Fiyat</th>
                            <th>İskonto</th>
                            <th>Son Fiyat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {job.offer.negotiationHistory.map((neg, idx) => (
                            <tr key={idx}>
                              <td>{new Date(neg.date).toLocaleDateString('tr-TR')}</td>
                              <td>{formatNumber(neg.originalTotal)} ₺</td>
                              <td style={{ color: 'var(--color-danger)' }}>-{formatNumber(neg.discountTotal)} ₺</td>
                              <td style={{ fontWeight: 600 }}>{formatNumber(neg.finalTotal)} ₺</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ color: 'var(--color-text-light)', fontSize: 13, textAlign: 'center' }}>
                        Henüz fiyat değişikliği veya pazarlık yapılmadı.
                      </div>
                    )}
                    {/* Red Geçmişi */}
                    {job.rejection && (
                      <div style={{ marginTop: hasNegotiation ? 12 : 0, padding: hasNegotiation ? '12px 16px' : 0, borderTop: hasNegotiation ? '1px solid var(--color-border)' : 'none' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8, fontSize: 13 }}>
                          ❌ Red Geçmişi
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                          <strong>Tarih:</strong> {job.rejection.rejectedAt ? new Date(job.rejection.rejectedAt).toLocaleDateString('tr-TR') : '-'}
                          {job.rejection.reason && <span> | <strong>Sebep:</strong> {job.rejection.reason}</span>}
                          {job.rejection.previousTotal && (
                            <span> | <strong>Red Edilen Fiyat:</strong> {formatNumber(job.rejection.previousTotal)} ₺</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pazarlık Paneli */}
                {inputs.showNegotiationPanel && originalTotal > 0 ? (
                  <div className="card" style={{ border: '2px solid var(--color-primary)' }}>
                    <div className="card-header" style={{ padding: '12px 16px', background: 'var(--color-primary-bg)' }}>
                      <h4 className="card-title" style={{ fontSize: 14 }}>💬 İskonto / Pazarlık</h4>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => setInputs((p) => ({ ...p, showNegotiationPanel: false, roleDiscounts: {} }))}
                      >
                        İptal
                      </button>
                    </div>
                    <div className="card-body" style={{ padding: 16 }}>
                      <div style={{ fontSize: 13, color: 'var(--color-text-light)', marginBottom: 12 }}>
                        Her iş kolu için yapılacak iskonto tutarını girin:
                      </div>
                      
                      {/* İş Kolu Bazlı İskonto - job.roles üzerinden */}
                      {job.roles?.map((role) => {
                        const roleKey = role.id || role.name;
                        const originalPrice = Number(rolePrices[roleKey]) || 0;
                        const discount = Number(currentDiscounts[roleKey] || 0);
                        const afterDiscount = originalPrice - discount;
                        
                        return (
                          <div key={roleKey} style={{ 
                            padding: '12px 16px', 
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 8,
                            marginBottom: 8
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontWeight: 600 }}>{role.name}</span>
                              <span style={{ fontSize: 13 }}>Mevcut: {formatNumber(originalPrice)} ₺</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ flex: 1 }}>
                                <label className="form-label" style={{ fontSize: 12 }}>İskonto Tutarı</label>
                                <CurrencyInput
                                  placeholder="0"
                                  value={currentDiscounts[roleKey] || ''}
                                  onChange={(val) => setInputs((p) => ({
                                    ...p,
                                    roleDiscounts: { ...p.roleDiscounts, [roleKey]: val }
                                  }))}
                                />
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>Yeni Fiyat</div>
                                <div style={{ fontWeight: 700, fontSize: 16, color: discount > 0 ? 'var(--color-success)' : 'inherit' }}>
                                  {formatNumber(afterDiscount)} ₺
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Toplam Özet */}
                      <div style={{ 
                        marginTop: 16, 
                        padding: 16, 
                        background: totalDiscount > 0 ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)',
                        borderRadius: 8,
                        border: totalDiscount > 0 ? '2px solid var(--color-success)' : 'none'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span>İlk Toplam:</span>
                          <span>{formatNumber(originalTotal)} ₺</span>
                        </div>
                        {totalDiscount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--color-danger)' }}>
                            <span>Toplam İskonto:</span>
                            <span>-{formatNumber(totalDiscount)} ₺</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                          <span>ANLAŞILAN FİYAT:</span>
                          <span style={{ color: 'var(--color-success)' }}>{formatNumber(finalTotal)} ₺</span>
                        </div>
                      </div>
                      
                      {/* Onay Butonu */}
                      <button
                        className="btn btn-success"
                        type="button"
                        style={{ width: '100%', marginTop: 16 }}
                        disabled={actionLoading}
                        onClick={() => {
                          // Pazarlık geçmişine ekle
                          const history = job.offer?.negotiationHistory || [];
                          const newHistory = [...history, {
                            date: new Date().toISOString(),
                            originalTotal,
                            discountTotal: totalDiscount,
                            finalTotal,
                            roleDiscounts: { ...currentDiscounts }
                          }];
                          
                          // Yeni fiyatları hesapla
                          const newRolePrices = {};
                          job.roles?.forEach((role) => {
                            const roleKey = role.id || role.name;
                            const oldPrice = Number(rolePrices[roleKey]) || 0;
                            newRolePrices[roleKey] = oldPrice - (Number(currentDiscounts[roleKey]) || 0);
                          });
                          
                          act(
                            () =>
                              updateJobStatus(job.id, {
                                status: 'ANLASMA_YAPILIYOR',
                                offer: {
                                  ...job.offer,
                                  total: finalTotal,
                                  rolePrices: newRolePrices,
                                  negotiationHistory: newHistory,
                                  agreedDate: new Date().toISOString()
                                },
                              }),
                            { transition: 'ANLASMA_YAPILIYOR' }
                          );
                        }}
                      >
                        ✓ Bu Fiyatla Anlaşıldı - Devam Et
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal Butonlar */
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      className="btn btn-success"
                      type="button"
                      style={{ flex: 1 }}
                      disabled={actionLoading}
                      onClick={() =>
                        act(
                          () =>
                            updateJobStatus(job.id, { 
                              status: 'ANLASMA_YAPILIYOR',
                              offer: { ...job.offer, agreedDate: new Date().toISOString() }
                            }),
                          { transition: 'ANLASMA_YAPILIYOR' }
                        )
                      }
                    >
                      ✓ Fiyat Onaylandı
                    </button>
                    <button
                      className="btn btn-warning"
                      type="button"
                      style={{ flex: 1 }}
                      disabled={actionLoading}
                      onClick={() => setInputs((p) => ({ ...p, showNegotiationPanel: true }))}
                    >
                      💬 Pazarlık / İskonto
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      style={{ flex: 1 }}
                      disabled={actionLoading}
                      onClick={() => setInputs((p) => ({ ...p, showRejectionModal: true }))}
                    >
                      ✕ Reddedildi
                    </button>
                  </div>
                )}

                {/* Ret Modal */}
                {inputs.showRejectionModal && (
                  <div className="card" style={{ border: '2px solid var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                    <div className="card-header" style={{ padding: '12px 16px' }}>
                      <h4 className="card-title" style={{ fontSize: 14, color: 'var(--color-danger)' }}>❌ Ret / Anlaşılamadı</h4>
                    </div>
                    <div className="card-body" style={{ padding: 16 }}>
                      <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                          <label className="form-label">Ret Kategorisi *</label>
                          <select
                            className="form-select"
                            value={inputs.rejectionCategory || ''}
                            onChange={(e) => setInputs((p) => ({ ...p, rejectionCategory: e.target.value }))}
                          >
                            <option value="">Seçin...</option>
                            <option value="FIYAT_YUKSEK">💰 Fiyat Yüksek Bulundu</option>
                            <option value="ZAMANLAMA">📅 Zamanlama Uymuyor</option>
                            <option value="BASKA_FIRMA">🏢 Başka Firmaya Gitti</option>
                            <option value="PROJE_IPTAL">🚫 Projeyi İptal Etti</option>
                            <option value="DUSUNUYOR">🤔 Düşünüyor / Bekliyor</option>
                            <option value="DIGER">📝 Diğer</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Takip Tarihi</label>
            <input
              className="form-input"
                            type="date"
                            value={inputs.rejectionFollowUp || ''}
                            onChange={(e) => setInputs((p) => ({ ...p, rejectionFollowUp: e.target.value }))}
                            min={new Date().toISOString().split('T')[0]}
                          />
                          <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                            💡 Bu tarihte tekrar aranacak
              </div>
                        </div>
                      </div>
                      <div className="form-group" style={{ marginTop: 12 }}>
                        <label className="form-label">Açıklama / Not *</label>
                        <textarea
                          className="form-textarea"
                          placeholder="Detaylı açıklama yazın..."
                          rows={3}
                          value={inputs.rejectionReason || ''}
                          onChange={(e) => setInputs((p) => ({ ...p, rejectionReason: e.target.value }))}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button
                          className="btn btn-secondary"
              type="button"
                          onClick={() => setInputs((p) => ({ ...p, showRejectionModal: false }))}
                        >
                          İptal
                        </button>
                        <button
                          className="btn btn-danger"
                          type="button"
                          disabled={actionLoading || !inputs.rejectionReason || !inputs.rejectionCategory}
              onClick={() =>
                  act(
                    () =>
                                updateJobStatus(job.id, {
                                  status: 'ANLASILAMADI',
                                  rejection: {
                                    category: inputs.rejectionCategory,
                                    reason: inputs.rejectionReason,
                                    followUpDate: inputs.rejectionFollowUp || null,
                                    date: new Date().toISOString(),
                                    lastOffer: job.offer
                        },
                      }),
                              { transition: 'ANLASILAMADI' }
                )
              }
            >
                          İşi Anlaşılamadı Olarak İşaretle
            </button>
                      </div>
                      {(!inputs.rejectionReason || !inputs.rejectionCategory) && (
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                          ⚠️ Kategori ve açıklama zorunludur.
          </div>
          )}
                    </div>
        </div>
      )}
              </>
              );
            })()}

            {/* ANLASILAMADI - İş reddedildi */}
            {job.status === 'ANLASILAMADI' && (() => {
              const rejectionCategories = {
                'FIYAT_YUKSEK': { label: 'Fiyat Yüksek Bulundu', icon: '💰', color: 'warning' },
                'ZAMANLAMA': { label: 'Zamanlama Uymuyor', icon: '📅', color: 'secondary' },
                'BASKA_FIRMA': { label: 'Başka Firmaya Gitti', icon: '🏢', color: 'danger' },
                'PROJE_IPTAL': { label: 'Projeyi İptal Etti', icon: '🚫', color: 'danger' },
                'DUSUNUYOR': { label: 'Düşünüyor / Bekliyor', icon: '🤔', color: 'info' },
                'DIGER': { label: 'Diğer', icon: '📝', color: 'secondary' }
              };
              const category = rejectionCategories[job.rejection?.category] || rejectionCategories['DIGER'];
              const lastOffer = job.rejection?.lastOffer || job.offer;
              const hasFollowUp = job.rejection?.followUpDate;
              const isFollowUpPast = hasFollowUp && new Date(job.rejection.followUpDate) <= new Date();
              
              return (
              <div className="card" style={{ border: '2px solid var(--color-danger)' }}>
                <div className="card-header" style={{ background: 'var(--color-danger)', color: 'white' }}>
                  <h3 className="card-title" style={{ color: 'white' }}>❌ Anlaşılamadı</h3>
                  <span style={{ fontSize: 12, opacity: 0.9 }}>
                    {job.rejection?.date ? new Date(job.rejection.date).toLocaleDateString('tr-TR') : ''}
                  </span>
                </div>
                <div className="card-body" style={{ padding: 20 }}>
                  
                  {/* Ret Bilgileri */}
                  <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{job.customerName}</div>
                      {customer.phone && (
                        <div style={{ fontSize: 13, marginTop: 4 }}>📞 {customer.phone}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>RET SEBEBİ</div>
                      <div style={{ fontWeight: 600 }}>
                        {category.icon} {category.label}
                      </div>
                    </div>
                  </div>
                  
                  {/* Ret Açıklaması */}
                  {job.rejection?.reason && (
                    <div style={{ padding: 12, background: 'var(--color-danger-bg)', borderRadius: 8, marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Açıklama:</div>
                      <div>{job.rejection.reason}</div>
                    </div>
                  )}
                  
                  {/* Takip Tarihi */}
                  {hasFollowUp && (
                    <div style={{ 
                      padding: 12, 
                      background: isFollowUpPast ? 'var(--color-warning-bg)' : 'var(--color-bg-secondary)', 
                      borderRadius: 8, 
                      marginBottom: 16,
                      border: isFollowUpPast ? '2px solid var(--color-warning)' : 'none'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 12, color: 'var(--color-text-light)' }}>📅 TAKİP TARİHİ</span>
                          <div style={{ fontWeight: 600 }}>
                            {new Date(job.rejection.followUpDate).toLocaleDateString('tr-TR')}
                          </div>
                        </div>
                        {isFollowUpPast && (
                          <span className="badge badge-warning">⏰ Takip Zamanı!</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* İş Özeti */}
                  <div className="card subtle-card" style={{ marginBottom: 16 }}>
                    <div className="card-header" style={{ padding: '12px 16px' }}>
                      <h4 className="card-title" style={{ fontSize: 14 }}>📋 İş Özeti</h4>
                    </div>
                    <div className="card-body" style={{ padding: 16 }}>
                      {/* Ölçü Bilgisi */}
                      <div className="metric-row" style={{ marginBottom: 8 }}>
                        <span className="metric-label">📐 Ölçü Alındı</span>
                        <span className="metric-value">
                          {job.measure?.measurements?.date 
                            ? new Date(job.measure.measurements.date).toLocaleDateString('tr-TR') 
                            : job.measure?.appointment?.date 
                              ? new Date(job.measure.appointment.date).toLocaleDateString('tr-TR')
                              : '-'}
                        </span>
                      </div>
                      
                      {/* Dosyalar */}
                      {jobDocuments.length > 0 && (
                        <div className="metric-row" style={{ marginBottom: 8 }}>
                          <span className="metric-label">📁 Yüklü Dosyalar</span>
                          <span className="metric-value">{jobDocuments.length} dosya</span>
                        </div>
                      )}
                      
                      {/* Son Fiyat Teklifi */}
                      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>💰 Son Fiyat Teklifi:</div>
                        {lastOffer?.rolePrices && Object.entries(lastOffer.rolePrices).map(([key, val]) => (
                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span>{job.roles?.find(r => (r.id || r.name) === key)?.name || key}</span>
                            <span>{formatNumber(val)} ₺</span>
                          </div>
                        ))}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          fontWeight: 700, 
                          fontSize: 16, 
                          marginTop: 8, 
                          paddingTop: 8, 
                          borderTop: '1px solid var(--color-border)' 
                        }}>
                          <span>TOPLAM:</span>
                          <span>{formatNumber(lastOffer?.total || 0)} ₺</span>
                        </div>
                      </div>
                      
                      {/* Pazarlık Geçmişi */}
                      {lastOffer?.negotiationHistory?.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>📜 Pazarlık Geçmişi:</div>
                          {lastOffer.negotiationHistory.map((neg, idx) => (
                            <div key={idx} style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 4 }}>
                              {new Date(neg.date).toLocaleDateString('tr-TR')}: {formatNumber(neg.originalTotal)} ₺ → {formatNumber(neg.finalTotal)} ₺ 
                              <span style={{ color: 'var(--color-danger)' }}> (-{formatNumber(neg.discountTotal)} ₺)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Yeniden Aktifleştirme */}
                  <div style={{ 
                    padding: 16, 
                    background: 'var(--color-bg-secondary)', 
                    borderRadius: 8,
                    border: '1px dashed var(--color-border)'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>🔄 Müşteri Geri Döndü mü?</div>
                    <div className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
                      Müşteri tekrar ilgileniyorsa, son fiyat üzerinden yeni iskonto yapabilir veya mevcut fiyatla devam edebilirsiniz.
                    </div>
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={actionLoading}
                      onClick={() => {
                        // Son teklifi geri yükle ve FIYAT_VERILDI durumuna dön
                        act(
                          () =>
                            updateJobStatus(job.id, {
                              status: 'FIYAT_VERILDI',
                              offer: {
                                ...lastOffer,
                                reactivatedAt: new Date().toISOString(),
                                reactivatedFrom: job.rejection
                              }
                            }),
                          { transition: 'FIYAT_VERILDI' }
                        );
                      }}
                    >
                      🔄 İşi Yeniden Aktifleştir
                    </button>
                  </div>
                </div>
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {isStageSelected('agreement') && (
        <div className="card">
          {/* Salt Okunur Banner */}
          {isReadOnly && (() => {
            const history = getStageHistory(job, 'agreement');
            return (
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderBottom: '1px solid var(--color-border)',
                padding: '12px 16px',
                color: '#475569'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: history.length > 0 ? 10 : 0 }}>
                  <span style={{ fontSize: 18 }}>📂</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Arşiv Görünümü</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Bu aşama tamamlandı. Sadece görüntüleme modundasınız.</div>
                  </div>
                </div>
                {history.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#64748b' }}>📍 Geçilen Alt Aşamalar:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {history.map((h, idx) => (
                        <span key={idx} className="badge badge-secondary" style={{ fontSize: 10 }}>
                          {h.toLabel} • {new Date(h.at).toLocaleDateString('tr-TR')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="card-header">
            <h3 className="card-title">📝 Anlaşma</h3>
            {renderStatus(job.status)}
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            
            {/* Fiyat Özeti - Her zaman göster */}
            <div className="card" style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success)' }}>
              <div className="card-body" style={{ padding: 16 }}>
                <div className="grid grid-3" style={{ gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                    <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="text-muted" style={{ fontSize: 12 }}>ANLAŞILAN FİYAT</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-success)' }}>
                      {formatNumber(job.offer?.total || 0)} ₺
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="text-muted" style={{ fontSize: 12 }}>ONAY TARİHİ</div>
                    <div style={{ fontWeight: 600 }}>
                      {job.approval?.approvedAt 
                        ? new Date(job.approval.approvedAt).toLocaleDateString('tr-TR')
                        : new Date().toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pazarlık/Fiyat Geçmişi - Anlaşma aşamasında */}
            <div className="card subtle-card">
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <h4 className="card-title" style={{ fontSize: 14 }}>📜 Fiyat Geçmişi</h4>
              </div>
              <div className="card-body" style={{ padding: job.offer?.negotiationHistory?.length > 0 ? 0 : 16 }}>
                {job.offer?.negotiationHistory?.length > 0 ? (
                  <table className="table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Tarih</th>
                        <th>İlk Fiyat</th>
                        <th>İskonto</th>
                        <th>Son Fiyat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.offer.negotiationHistory.map((neg, idx) => (
                        <tr key={idx}>
                          <td>{new Date(neg.date).toLocaleDateString('tr-TR')}</td>
                          <td>{formatNumber(neg.originalTotal)} ₺</td>
                          <td style={{ color: 'var(--color-danger)' }}>-{formatNumber(neg.discountTotal)} ₺</td>
                          <td style={{ fontWeight: 600 }}>{formatNumber(neg.finalTotal)} ₺</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ color: 'var(--color-text-light)', fontSize: 13, textAlign: 'center' }}>
                    Doğrudan anlaşıldı, pazarlık yapılmadı.
                  </div>
                )}
                {/* Red Geçmişi */}
                {job.rejection && (
                  <div style={{ marginTop: job.offer?.negotiationHistory?.length > 0 ? 12 : 0, padding: job.offer?.negotiationHistory?.length > 0 ? '12px 16px' : 0, borderTop: job.offer?.negotiationHistory?.length > 0 ? '1px solid var(--color-border)' : 'none' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8, fontSize: 13 }}>
                      ❌ Red Geçmişi
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                      <strong>Tarih:</strong> {job.rejection.rejectedAt ? new Date(job.rejection.rejectedAt).toLocaleDateString('tr-TR') : '-'}
                      {job.rejection.reason && <span> | <strong>Sebep:</strong> {job.rejection.reason}</span>}
                      {job.rejection.previousTotal && (
                        <span> | <strong>Red Edilen Fiyat:</strong> {formatNumber(job.rejection.previousTotal)} ₺</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Salt okunur modda ödeme özeti */}
            {isReadOnly && job.approval?.paymentPlan && (
              <div className="card subtle-card" style={{ padding: 16, background: '#f8fafc' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: 14 }}>📋 Ödeme Planı Özeti</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Nakit */}
                  {(job.approval.paymentPlan.cash?.amount > 0 || job.approval.paymentPlan.cash > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'white', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>💵</span>
                        <span style={{ fontWeight: 500 }}>Nakit</span>
                        {job.approval.paymentPlan.cash?.date && (
                          <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                            {new Date(job.approval.paymentPlan.cash.date).toLocaleDateString('tr-TR')}
                          </span>
                        )}
                      </div>
                      <span style={{ fontWeight: 600 }}>
                        {formatNumber(job.approval.paymentPlan.cash?.amount || job.approval.paymentPlan.cash || 0)} ₺
                      </span>
                    </div>
                  )}
                  
                  {/* Kart */}
                  {(job.approval.paymentPlan.card?.amount > 0 || job.approval.paymentPlan.card > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'white', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>💳</span>
                        <span style={{ fontWeight: 500 }}>Kredi Kartı</span>
                        {job.approval.paymentPlan.card?.date && (
                          <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                            {new Date(job.approval.paymentPlan.card.date).toLocaleDateString('tr-TR')}
                          </span>
                        )}
                      </div>
                      <span style={{ fontWeight: 600 }}>
                        {formatNumber(job.approval.paymentPlan.card?.amount || job.approval.paymentPlan.card || 0)} ₺
                      </span>
                    </div>
                  )}
                  
                  {/* Çek */}
                  {(job.approval.paymentPlan.cheque?.total > 0 || job.approval.paymentPlan.cheque > 0) && (
                    <div style={{ padding: '10px 12px', background: 'white', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: job.approval.paymentPlan.cheque?.items?.length > 0 ? 8 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>📝</span>
                          <span style={{ fontWeight: 500 }}>Çek</span>
                          {job.approval.paymentPlan.cheque?.count > 0 && (
                            <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                              {job.approval.paymentPlan.cheque.count} adet
                            </span>
                          )}
                          {job.approval.paymentPlan.cheque?.received && (
                            <span className="badge badge-success" style={{ fontSize: 10 }}>Teslim alındı</span>
                          )}
                        </div>
                        <span style={{ fontWeight: 600 }}>
                          {formatNumber(job.approval.paymentPlan.cheque?.total || job.approval.paymentPlan.cheque || 0)} ₺
                        </span>
                      </div>
                      {/* Çek detayları */}
                      {job.approval.paymentPlan.cheque?.items?.length > 0 && (
                        <div style={{ fontSize: 12, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                          {job.approval.paymentPlan.cheque.items.map((c, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: idx < job.approval.paymentPlan.cheque.items.length - 1 ? '1px dashed var(--color-border)' : 'none' }}>
                              <span className="text-muted">{c.bank} - {c.chequeNo || c.number}</span>
                              <span>{formatNumber(c.amount)} ₺ <span className="text-muted">({formatDate(c.due)})</span></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Teslim Sonrası */}
                  {(job.approval.paymentPlan.afterDelivery?.amount > 0 || job.approval.paymentPlan.afterDelivery > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--color-warning-bg)', borderRadius: 6, border: '1px solid var(--color-warning)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>🏠</span>
                        <span style={{ fontWeight: 500 }}>Teslim Sonrası</span>
                        {job.approval.paymentPlan.afterDelivery?.note && (
                          <span className="text-muted" style={{ fontSize: 11 }}>({job.approval.paymentPlan.afterDelivery.note})</span>
                        )}
                      </div>
                      <span style={{ fontWeight: 600 }}>
                        {formatNumber(job.approval.paymentPlan.afterDelivery?.amount || job.approval.paymentPlan.afterDelivery || 0)} ₺
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Toplam */}
                <div style={{ marginTop: 12, padding: 12, background: 'var(--color-primary-bg)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>TOPLAM</span>
                  <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-primary)' }}>
                    {formatNumber(job.approval.paymentPlan.total || job.offer?.total || 0)} ₺
                  </span>
                </div>
              </div>
            )}
            
            {/* Ödeme Bilgileri - Düzenleme modu */}
            {!isReadOnly && (
            <>
            <div className="card subtle-card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-secondary)' }}>💰 Ödeme Planı</h4>
              
              {/* NAKİT */}
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>💵</span>
                  <span style={{ fontWeight: 600 }}>Nakit</span>
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Tutar</label>
                    <CurrencyInput
                    placeholder="0"
              value={inputs.payCash}
                      onChange={(val) => setInputs((p) => ({ ...p, payCash: val }))}
            />
                </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Ödeme Tarihi <span className="text-muted">(boş = bugün)</span></label>
            <input
              className="form-input"
                      type="date"
                      value={inputs.payCashDate || ''}
                      onChange={(e) => setInputs((p) => ({ ...p, payCashDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* KREDİ KARTI */}
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>💳</span>
                  <span style={{ fontWeight: 600 }}>Kredi Kartı</span>
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Tutar</label>
                    <CurrencyInput
                    placeholder="0"
              value={inputs.payCard}
                      onChange={(val) => setInputs((p) => ({ ...p, payCard: val }))}
            />
                </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Çekim Tarihi <span className="text-muted">(boş = bugün)</span></label>
                    <input
                      className="form-input"
                      type="date"
                      value={inputs.payCardDate || ''}
                      onChange={(e) => setInputs((p) => ({ ...p, payCardDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* TESLİM SONRASI */}
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-warning-bg)', borderRadius: 8, border: '1px solid var(--color-warning)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>🏠</span>
                  <span style={{ fontWeight: 600 }}>Teslim Sonrası</span>
                  <span className="badge badge-warning" style={{ fontSize: 10 }}>Montaj bitince hatırlatılacak</span>
                </div>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Tutar</label>
                    <CurrencyInput
                      placeholder="0"
                      value={inputs.payAfter}
                      onChange={(val) => setInputs((p) => ({ ...p, payAfter: val }))}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Not</label>
                    <input
                      className="form-input"
                      placeholder="Opsiyonel not..."
                      value={inputs.payAfterNote || ''}
                      onChange={(e) => setInputs((p) => ({ ...p, payAfterNote: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* ÇEK TOPLAMI */}
              <div style={{ padding: 12, background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📝</span>
                    <span style={{ fontWeight: 600 }}>Çek</span>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                    Toplam: {formatNumber(chequeTotal)} ₺
                  </div>
                </div>
                
                {/* Çek alındı mı toggle */}
                <div style={{ marginBottom: 12, padding: 10, background: 'white', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={inputs.chequesReceived || false}
                      onChange={(e) => setInputs((p) => ({ ...p, chequesReceived: e.target.checked }))}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ fontWeight: 500 }}>Çekler teslim alındı</span>
                  </label>
                  {!inputs.chequesReceived && (
                    <span className="text-muted" style={{ fontSize: 11 }}>
                      (Alınmadıysa sadece adet ve toplam tutar girin)
                    </span>
                  )}
                </div>

                {/* Çek alınmadıysa - sadece adet ve tutar */}
                {!inputs.chequesReceived && (
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Çek Adedi</label>
            <input
              className="form-input"
              type="number"
                        min="0"
                    placeholder="0"
                        value={inputs.chequeCount || ''}
                        onChange={(e) => setInputs((p) => ({ ...p, chequeCount: e.target.value }))}
                  />
                </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Toplam Tutar</label>
                      <CurrencyInput
                        placeholder="0"
                        value={inputs.chequeTotalAmount || ''}
                        onChange={(val) => setInputs((p) => ({ ...p, chequeTotalAmount: val }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Çek Detayları - Sadece alındıysa */}
            {inputs.chequesReceived && (
            <div className="card subtle-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>📝 Çek Detayları</h4>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {inputs.chequeLines?.length || 0} çek • Ort. vade: {avgChequeDays} gün
                </span>
              </div>
              <div style={{ padding: 12, background: 'var(--color-bg-secondary)', borderRadius: 8, marginBottom: 12 }}>
              <div className="grid grid-3" style={{ gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Tutar *</label>
                    <CurrencyInput
                    placeholder="0"
                    value={inputs.chequeDraftAmount || ''}
                      onChange={(val) => setInputs((p) => ({ ...p, chequeDraftAmount: val }))}
                  />
                </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Vade Tarihi *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={inputs.chequeDraftDue || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, chequeDraftDue: e.target.value }))}
                  />
                </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Banka *</label>
                  <input
                    className="form-input"
                    placeholder="Banka adı"
                    value={inputs.chequeDraftBank || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, chequeDraftBank: e.target.value }))}
                  />
                </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Şube</label>
                  <input
                    className="form-input"
                      placeholder="Şube adı (opsiyonel)"
                    value={inputs.chequeDraftBranch || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, chequeDraftBranch: e.target.value }))}
                  />
                </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Çek No *</label>
                  <input
                    className="form-input"
                    placeholder="Çek numarası"
                    value={inputs.chequeDraftNumber || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, chequeDraftNumber: e.target.value }))}
                  />
                </div>
                  <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      disabled={!inputs.chequeDraftAmount || !inputs.chequeDraftDue || !inputs.chequeDraftBank || !inputs.chequeDraftNumber}
                  onClick={() => {
                    const amt = Number(inputs.chequeDraftAmount || 0);
                    if (!amt) return;
                    setInputs((p) => ({
                      ...p,
                      chequeLines: [
                        ...p.chequeLines,
                        {
                          amount: amt,
                          due: p.chequeDraftDue || '',
                          bank: p.chequeDraftBank || '',
                          branch: p.chequeDraftBranch || '',
                              chequeNo: p.chequeDraftNumber || '',
                              id: Date.now()
                            }
                      ],
                      chequeDraftAmount: '',
                      chequeDraftDue: '',
                      chequeDraftBank: '',
                      chequeDraftBranch: '',
                          chequeDraftNumber: ''
                    }));
                  }}
                >
                  + Çek Ekle
                </button>
              </div>
                </div>
              </div>
              
              {/* Eklenen Çekler Listesi */}
              {(inputs.chequeLines?.length || 0) > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="text-muted" style={{ fontSize: 11, marginBottom: 8 }}>EKLENMİŞ ÇEKLER</div>
                  <div className="table-container" style={{ maxHeight: 200, overflow: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tutar</th>
                        <th>Vade</th>
                        <th>Banka</th>
                        <th>Şube</th>
                          <th>Çek No</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                        {(inputs.chequeLines || []).map((c, idx) => (
                          <tr key={c.id || `${c.chequeNo}-${idx}`}>
                          <td><strong>{formatNumber(c.amount)} ₺</strong></td>
                          <td>{formatDate(c.due)}</td>
                          <td>{c.bank || '-'}</td>
                          <td>{c.branch || '-'}</td>
                            <td>{c.chequeNo || c.number || '-'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger btn-small btn-icon"
              onClick={() =>
                                setInputs((p) => ({
                                  ...p,
                                  chequeLines: p.chequeLines.filter((_, i) => i !== idx),
                                }))
                              }
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              )}
            </div>
            )}

            {/* Toplam Özeti */}
            <div className="card subtle-card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>📊 Özet</h4>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="metric-row" style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 8 }}>
                  <div>
                    <div className="metric-label">Teklif Toplamı</div>
                  </div>
                  <strong style={{ fontSize: 18 }}>{formatNumber(offerTotalValue)} ₺</strong>
                </div>
                <div className="metric-row" style={{ background: isPaymentMatch ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', padding: '12px', borderRadius: 8 }}>
                  <div>
                    <div className="metric-label">Ödeme Toplamı</div>
                  </div>
                  <strong style={{ fontSize: 18, color: isPaymentMatch ? 'var(--color-success)' : 'var(--color-danger)' }}>{formatNumber(paymentTotal)} ₺</strong>
                </div>
              </div>
              {!isPaymentMatch && (
                <div className="error-text" style={{ marginTop: 8, padding: 8, background: 'var(--color-danger-bg)', borderRadius: 4 }}>
                  ⚠️ Toplam ödeme, teklif tutarıyla eşleşmiyor. Fark: {formatNumber(Math.abs(offerTotalValue - paymentTotal))} ₺
                </div>
              )}
              {avgChequeDays > 90 && (
                <div style={{ marginTop: 8, padding: 8, background: '#fef3cd', borderRadius: 4, color: '#856404' }}>
                  ⏰ Ortalama vade {avgChequeDays} gün. Uzun vade için ek onay gerekebilir.
                </div>
              )}
            </div>

            {/* Sözleşme Dosyası */}
            <div className="card subtle-card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>📄 Sözleşme Dosyası</h4>
              <div className="file-upload-zone">
                <input
                  type="file"
                  id="contract-file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      await handleDocUpload(file, 'sozlesme', 'İmzalı Sözleşme');
                      e.target.value = '';
                    }
                  }}
                />
                <label htmlFor="contract-file" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  📎 Sözleşme Yükle
                </label>
                {jobDocuments.filter((d) => d.type === 'sozlesme').length > 0 && (
                  <span className="badge badge-success" style={{ marginLeft: 8 }}>
                    ✓ {jobDocuments.filter((d) => d.type === 'sozlesme').length} dosya yüklendi
                  </span>
                )}
              </div>
              {/* Yüklü Sözleşmeler */}
              {jobDocuments.filter((d) => d.type === 'sozlesme').map((doc) => (
                <div key={doc.id} className="metric-row" style={{ marginTop: 8, fontSize: 13 }}>
                  <a
                    href={getDocumentDownloadUrl(doc.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary"
                  >
                    📎 {doc.originalName}
                  </a>
                  <button
                    type="button"
                    className="btn btn-danger btn-small btn-icon"
                    onClick={() => handleDocDelete(doc.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                Müşteriye imzalatılan sözleşmeyi yükleyin
              </div>
            </div>

            <div className="btn-group" style={{ gap: 12, marginTop: 8 }}>
              <button
                className="btn btn-success"
                type="button"
                disabled={actionLoading || !isPaymentMatch}
                onClick={() =>
                  act(async () => {
                    if (!isPaymentMatch) {
                      throw new Error('Ödeme toplamı teklif tutarıyla eşleşmiyor.');
                    }
                    // Çek kontrolü - sadece çekler alındıysa detay kontrolü yap
                    if (inputs.chequesReceived) {
                      const chequeSum = (inputs.chequeLines || []).reduce((s, c) => s + Number(c.amount || 0), 0);
                    if (chequeSum !== chequeTotal) {
                      throw new Error('Çek parçaları toplamı hatalı.');
                      }
                    }
                    const payload = {
                    paymentPlan: {
                        cash: {
                          amount: Number(inputs.payCash || 0),
                          date: inputs.payCashDate || new Date().toISOString().split('T')[0], // Boşsa bugün
                          status: 'pending'
                        },
                        card: {
                          amount: Number(inputs.payCard || 0),
                          date: inputs.payCardDate || new Date().toISOString().split('T')[0], // Boşsa bugün
                          status: 'pending'
                        },
                        cheque: {
                          total: chequeTotal,
                          received: inputs.chequesReceived || false,
                          count: inputs.chequesReceived ? (inputs.chequeLines?.length || 0) : Number(inputs.chequeCount || 0),
                          items: inputs.chequesReceived ? (inputs.chequeLines || []) : [],
                          status: 'pending'
                        },
                        afterDelivery: {
                          amount: Number(inputs.payAfter || 0),
                          note: inputs.payAfterNote || '',
                          status: 'pending'
                        },
                        total: paymentTotal
                      },
                      contractUrl: jobDocuments.find((d) => d.type === 'sozlesme')?.id || null,
                    stockNeeds: [],
                    };
                    const res = await startJobApproval(job.id, payload);
                    applyLocalJobPatch(job.id, {
                      approval: { paymentPlan: payload.paymentPlan },
                      offer: { ...job.offer, total: offerTotalValue },
                    });
                    return res;
                  })
                }
              >
                ✓ Anlaşmayı Tamamla - Stok Kontrolüne Geç
            </button>
            </div>
            {!isPaymentMatch && (
              <div className="text-muted" style={{ fontSize: 12, color: 'var(--color-danger)' }}>
                ⚠️ Ödeme toplamı teklif tutarıyla eşleşmiyor. Fark: {formatNumber(Math.abs(offerTotalValue - paymentTotal))} ₺
              </div>
            )}
            </>
            )}
          </div>
        </div>
      )}

      {isStageSelected('stock') && (
        <div className="card">
          <div className="card-header" style={{ alignItems: 'center' }}>
            <h3 className="card-title">Stok / Rezervasyon</h3>
            {job.status === 'SONRA_URETILECEK' ? (
              <div className="badge badge-info">📦 Sonra Üretilecek</div>
            ) : isReadOnly ? (
              <div className="badge badge-success">
                {job.stock?.ready ? '✓ Üretime Alındı' : '📦 Rezerve Edildi'}
              </div>
            ) : (
            <div className="badge badge-secondary">
              Mevcut: {stockSummary.total} • Kritik: {stockSummary.critical}
          </div>
            )}
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            {/* SONRA_URETILECEK Modu - Rezerve Edilmiş, Üretime Al Bekliyor */}
            {job.status === 'SONRA_URETILECEK' ? (
              <>
                {/* Bilgi Banner */}
                <div style={{ 
                  background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', 
                  padding: 16, 
                  borderRadius: 12,
                  border: '1px solid #3b82f6',
                  marginBottom: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>📦</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>
                        Bu iş sonra üretilmek üzere bekletiliyor
                      </div>
                      <div style={{ fontSize: 13, color: '#1e40af' }}>
                        Stok rezerve edilmiş durumda. Hazır olduğunda "Üretime Al" butonuna tıklayın.
                      </div>
                      {job.stock?.estimatedDate && (
                        <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 4 }}>
                          📅 Tahmini Tarih: <strong>{new Date(job.stock.estimatedDate).toLocaleDateString('tr-TR')}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Not */}
                {job.stock?.purchaseNotes && (
                  <div className="text-muted" style={{ fontStyle: 'italic', marginBottom: 8 }}>
                    📝 {job.stock.purchaseNotes}
                  </div>
                )}

                {/* Rezerve Edilen Ürünler */}
                <div className="card subtle-card">
                  <div className="card-header" style={{ padding: '12px 16px' }}>
                    <h4 className="card-title" style={{ fontSize: 14 }}>Rezerve Edilen Ürünler</h4>
                    <span className="badge badge-info">{job.stock?.items?.length || 0} kalem</span>
                  </div>
                  {(job.stock?.items?.length || 0) === 0 ? (
                    <div className="text-muted" style={{ padding: 16 }}>Bu iş için stok bilgisi kaydedilmemiş.</div>
                  ) : (
                    <div className="table-container">
                      <table className="table" style={{ fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th>Ürün</th>
                            <th>Ürün Kodu</th>
                            <th>Renk</th>
                            <th>Rezerve</th>
                            <th>Güncel Stok</th>
                            <th>Durum</th>
                          </tr>
                        </thead>
                        <tbody>
                          {job.stock.items.map((item, idx) => {
                            // Güncel stok bilgisini al
                            const currentStock = stockItems.find(s => s.id === item.id);
                            const currentAvailable = currentStock?.available || 0;
                            const currentOnHand = currentStock?.onHand || 0;
                            const hasEnough = currentOnHand >= item.qty;
                            const usesReserved = currentAvailable < item.qty && currentOnHand >= item.qty;
                            
                            return (
                              <tr key={idx} style={{ 
                                background: !hasEnough 
                                  ? 'rgba(239, 68, 68, 0.1)' 
                                  : usesReserved 
                                    ? 'rgba(251, 191, 36, 0.1)' 
                                    : 'transparent' 
                              }}>
                                <td style={{ fontWeight: 600 }}>{item.name}</td>
                                <td><code style={{ fontSize: 11 }}>{item.productCode || '-'}</code></td>
                                <td><span className="badge badge-secondary" style={{ fontSize: 10 }}>{item.colorCode || '-'}</span></td>
                                <td><strong>{item.qty}</strong> {item.unit || 'adet'}</td>
                                <td>
                                  <span style={{ 
                                    color: hasEnough ? 'var(--color-success)' : 'var(--color-danger)' 
                                  }}>
                                    {currentAvailable}/{currentOnHand}
                                  </span>
                                </td>
                                <td>
                                  {!hasEnough ? (
                                    <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>
                                      ❌ Stok yetersiz ({item.qty - currentOnHand} eksik)
                                    </span>
                                  ) : usesReserved ? (
                                    <span style={{ color: 'var(--color-warning)', fontSize: 12 }}>
                                      ⚠️ Rezerve stoktan kullanılacak
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--color-success)', fontSize: 12 }}>✅ Hazır</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Stok Uyarıları */}
                {(() => {
                  const stockIssues = (job.stock?.items || []).map(item => {
                    const currentStock = stockItems.find(s => s.id === item.id);
                    const currentOnHand = currentStock?.onHand || 0;
                    const currentAvailable = currentStock?.available || 0;
                    return {
                      ...item,
                      currentOnHand,
                      currentAvailable,
                      hasEnough: currentOnHand >= item.qty,
                      usesReserved: currentAvailable < item.qty && currentOnHand >= item.qty,
                      shortage: Math.max(0, item.qty - currentOnHand)
                    };
                  });
                  
                  const insufficientItems = stockIssues.filter(i => !i.hasEnough);
                  const reservedItems = stockIssues.filter(i => i.usesReserved);
                  const canProceed = insufficientItems.length === 0;
                  
                  return (
                    <>
                      {insufficientItems.length > 0 && (
                        <div style={{ 
                          background: 'rgba(239, 68, 68, 0.1)', 
                          border: '1px solid var(--color-danger)',
                          borderRadius: 8,
                          padding: 12
                        }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8 }}>
                            ❌ Stok Yetersiz - Üretime Alınamaz
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                            Bu iş için planlanan stok, başka işlerde kullanılmış veya eksik kalmış:
                          </div>
                          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: 12 }}>
                            {insufficientItems.map((item, idx) => (
                              <li key={idx}>
                                <strong>{item.name}</strong>: {item.qty} gerekli, {item.currentOnHand} mevcut ({item.shortage} eksik)
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {reservedItems.length > 0 && insufficientItems.length === 0 && (
                        <div style={{ 
                          background: 'rgba(251, 191, 36, 0.1)', 
                          border: '1px solid var(--color-warning)',
                          borderRadius: 8,
                          padding: 12
                        }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: 4 }}>
                            ⚠️ Dikkat: Başka işlere ait rezerve stok kullanılacak
                          </div>
                          <div style={{ fontSize: 12 }}>
                            Bu işlem devam ederse, aşağıdaki ürünler için başka işlerin stoğu etkilenecektir.
                          </div>
                        </div>
                      )}

                      {/* Üretime Al Butonu */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button
                          className="btn btn-success"
                          type="button"
                          style={{ padding: '12px 24px' }}
                          disabled={actionLoading || !canProceed}
                          onClick={() =>
                            act(async () => {
                              // Uyarı göster - rezerve stok kullanılacaksa
                              if (reservedItems.length > 0 && !window.confirm(
                                'Bazı ürünler için başka işlere ait rezerve stok kullanılacak.\n' +
                                'Bu, diğer işlerin stok ihtiyacını etkileyecektir.\n\n' +
                                'Devam etmek istiyor musunuz?'
                              )) {
                                return;
                              }
                              
                              // Stoktan düşme API'sini çağır
                              const consumePayload = {
                                jobId: job.id,
                                items: (job.stock?.items || []).map((l) => ({ itemId: l.id, qty: l.qty })),
                                reserveType: 'consume',
                                note: 'Üretime alındı - Stoktan düşüldü',
                              };
                              
                              const consumeResult = await bulkReserveStock(consumePayload);
                              
                              // Job status güncelle (URETIME_HAZIR)
                              const stockPayload = {
                                ready: true,
                                purchaseNotes: job.stock?.purchaseNotes || 'Üretime alındı',
                                items: job.stock?.items || [],
                              };
                              const result = await updateStockStatus(job.id, stockPayload);
                              
                              await pushLog('stock_consumed', 'Üretime alındı - Stoktan düşüldü', { 
                                consumed: job.stock?.items 
                              });
                              
                              // Lokal stok state'i güncelle
                              if (consumeResult.results) {
                                setStockItems((prev) =>
                                  prev.map((item) => {
                                    const updated = consumeResult.results.find((r) => r.itemId === item.id);
                                    if (!updated) return item;
                                    return {
                                      ...item,
                                      onHand: updated.newOnHand,
                                      reserved: updated.newReserved,
                                      available: updated.available,
                                    };
                                  })
                                );
                              }
                              
                              return result;
                            })
                          }
                        >
                          {actionLoading ? '⏳ İşleniyor...' : '🚀 Üretime Al'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : isReadOnly ? (
              /* Arşiv Modu - Kaydedilmiş Stok Bilgileri */
              <>
                {job.stock?.purchaseNotes && (
                  <div className="text-muted" style={{ fontStyle: 'italic', marginBottom: 8 }}>
                    📝 {job.stock.purchaseNotes}
                  </div>
                )}
                <div className="card subtle-card">
                  <div className="card-header" style={{ padding: '12px 16px' }}>
                    <h4 className="card-title" style={{ fontSize: 14 }}>Kullanılan Stok Kalemleri</h4>
                    <span className="badge badge-secondary">{job.stock?.items?.length || 0} kalem</span>
                  </div>
                  {(job.stock?.items?.length || 0) === 0 ? (
                    <div className="text-muted" style={{ padding: 16 }}>Bu iş için stok bilgisi kaydedilmemiş.</div>
                  ) : (
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Ürün</th>
                            <th>Ürün Kodu</th>
                            <th>Renk Kodu</th>
                            <th>Miktar</th>
                            <th>Birim</th>
                          </tr>
                        </thead>
                        <tbody>
                          {job.stock.items.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{item.name}</td>
                              <td><code>{item.productCode || '-'}</code></td>
                              <td>{item.colorCode || '-'}</td>
                              <td><strong>{item.qty}</strong></td>
                              <td>{item.unit || 'adet'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div className="text-muted">İş için birden fazla kalem rezerve edebilirsiniz.</div>
              <button className="btn btn-primary" type="button" onClick={() => setStockModalOpen(true)}>
                📦 Stoktan Kalem Ekle
              </button>
            </div>

            {/* Seçili Kalemler - Dataframe Görünümü */}
            <div className="card subtle-card">
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <h4 className="card-title" style={{ fontSize: 14 }}>Seçili Kalemler</h4>
                <span className="badge badge-secondary">{reservedLines.length} kalem</span>
              </div>
              {reservedLines.length === 0 ? (
                <div className="text-muted" style={{ padding: 16 }}>Henüz ekleme yapmadınız. "Stoktan Ekle" butonuna tıklayın.</div>
              ) : (
                <div className="table-container" style={{ maxHeight: 200, overflow: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Kalem</th>
                        <th>Kod</th>
                        <th>Renk</th>
                        <th>Mevcut</th>
                        <th>Miktar</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservedLines.map((line) => (
                        <tr key={line.id}>
                          <td style={{ fontWeight: 600 }}>{line.name}</td>
                          <td className="text-muted">{line.productCode || line.sku}</td>
                          <td><span className="badge badge-secondary">{line.colorCode || line.color || '-'}</span></td>
                          <td>{line.available} {line.unit}</td>
                          <td style={{ minWidth: 100 }}>
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              value={line.qty}
                              onChange={(e) => {
                                const newQty = Number(e.target.value) || 1;
                                setReservedLines((prev) =>
                                  prev.map((l) => (l.id === line.id ? { ...l, qty: newQty } : l))
                                );
                              }}
                              style={{ width: 80 }}
                            />
                          </td>
                          <td>
                            <button className="btn btn-danger btn-small btn-icon" type="button" onClick={() => removeLine(line.id)}>
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

            {/* Rezervasyon Notu */}
            <div className="form-group">
              <label className="form-label">Rezervasyon Notu</label>
              <textarea
                className="form-textarea"
                placeholder="Satınalma / rezervasyon notu"
                value={inputs.stockNote}
                onChange={(e) => setInputs((p) => ({ ...p, stockNote: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Eksik Stok Uyarısı */}
            {reservedLines.some((l) => l.qty > l.available) && (
              <div className="card" style={{ border: '2px solid var(--color-danger)', background: 'var(--color-danger-bg)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <strong style={{ color: 'var(--color-danger)' }}>Yetersiz Stok</strong>
                </div>
                <div className="text-muted" style={{ marginBottom: 8 }}>
                  Aşağıdaki kalemler için stok yetersiz. Sipariş oluşturmanız gerekiyor:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {reservedLines
                    .filter((l) => l.qty > l.available)
                    .map((l) => (
                      <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'white', borderRadius: 4, fontSize: 13 }}>
                        <span><strong>{l.name}</strong> ({l.productCode || l.sku})</span>
                        <span>
                          Talep: <strong>{l.qty}</strong> · Mevcut: <strong style={{ color: 'var(--color-danger)' }}>{l.available}</strong> · 
                          <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}> Eksik: {l.qty - l.available}</span>
                        </span>
                      </div>
                    ))}
              </div>
            <button
                  className="btn btn-warning"
              type="button"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    // Eksik ürünler için sipariş sayfasına yönlendir
                    const missing = reservedLines.filter((l) => l.qty > l.available);
                    // TODO: Sipariş oluşturma modal'ı aç
                    alert(`${missing.length} kalem için sipariş oluşturulacak. (Satınalma modülüne yönlendirilecek)`);
                  }}
                >
                  📦 Eksik Ürünler İçin Sipariş Oluştur
                </button>
              </div>
            )}

            {/* Aksiyon Butonları */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {/* Sonra Üret - Modal Açar */}
              <button
                className="btn btn-secondary"
                type="button"
                style={{ flex: 1, padding: '14px 20px' }}
              disabled={actionLoading || reservedLines.length === 0}
                onClick={() => {
                  // Modal aç, tahmini tarih sor
                  setSonraUretModalOpen(true);
                  setEstimatedDate('');
                  setProductionNote('');
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 20 }}>📦</span>
                  <span style={{ fontWeight: 600 }}>Sonra Üret</span>
                  <span style={{ fontSize: 11, opacity: 0.8 }}>Stok rezerve edilir</span>
                </div>
              </button>

              {/* Hemen Üretime Al */}
              <button
                className="btn btn-success"
                type="button"
                style={{ flex: 1, padding: '14px 20px' }}
                disabled={actionLoading || reservedLines.length === 0 || reservedLines.some((l) => l.qty > (l.onHand || l.available))}
              onClick={() =>
                act(async () => {
                    // Rezerve stoktan kullanılacak mı kontrol et
                    const usesReservedStock = reservedLines.some((l) => l.qty > l.available && l.qty <= (l.onHand || 0));
                    if (usesReservedStock && !window.confirm(
                      'Bazı ürünler için rezerve edilmiş stok kullanılacak.\n' +
                      'Bu, başka işlerin stok ihtiyacını etkileyebilir.\n\n' +
                      'Devam etmek istiyor musunuz?'
                    )) {
                      return;
                    }
                    
                    // Stoktan düşme API'sini çağır (consume)
                    const consumePayload = {
                    jobId: job.id,
                      items: reservedLines.map((l) => ({ itemId: l.id, qty: l.qty })),
                      reserveType: 'consume',
                      note: inputs.stockNote || 'Üretime alındı - Stoktan düşüldü',
                    };
                    
                    const consumeResult = await bulkReserveStock(consumePayload);
                    
                    // Job status güncelle (URETIME_HAZIR) - seçilen ürünleri de kaydet
                    const stockPayload = {
                      ready: true,
                      purchaseNotes: inputs.stockNote || 'Üretime alındı - Stoktan düşüldü',
                      items: reservedLines.map((l) => ({
                        id: l.id,
                        name: l.name,
                        productCode: l.productCode,
                        colorCode: l.colorCode,
                        qty: l.qty,
                        unit: l.unit,
                      })),
                    };
                    const result = await updateStockStatus(job.id, stockPayload);
                    
                    applyLocalJobPatch(job.id, { pendingPO: [] });
                    setPendingPO([]);
                    await pushLog('stock_consumed', 'Üretime alındı - Stoktan düşüldü', { consumed: reservedLines });
                    
                    // Lokal stok state'i güncelle
                    if (consumeResult.results) {
                  setStockItems((prev) =>
                    prev.map((item) => {
                          const updated = consumeResult.results.find((r) => r.itemId === item.id);
                          if (!updated) return item;
                          return {
                            ...item,
                            onHand: updated.newOnHand,
                            reserved: updated.newReserved,
                            available: updated.available,
                          };
                        })
                      );
                    }
                    
                  setReservedLines([]);
                  return result;
                })
              }
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 20 }}>🚀</span>
                  <span style={{ fontWeight: 600 }}>Hemen Üretime Al</span>
                  <span style={{ fontSize: 11, opacity: 0.8 }}>Stoktan düşülür</span>
                </div>
            </button>
            </div>

            {reservedLines.some((l) => l.qty > (l.onHand || l.available)) && (
              <div className="text-muted" style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                💡 Yetersiz fiziksel stok olduğu için üretime alınamaz. Önce sipariş oluşturun.
              </div>
            )}
            {reservedLines.some((l) => l.qty > l.available && l.qty <= (l.onHand || 0)) && (
              <div style={{ fontSize: 12, marginTop: 8, textAlign: 'center', color: 'var(--color-warning)' }}>
                ⚠️ Bazı ürünler için başka işlere ait rezerve stok kullanılacak!
              </div>
            )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Yeni Stok Modal - Hızlı Seçim Odaklı */}
      <Modal
        open={stockModalOpen}
        title="📦 Stoktan Kalem Ekle"
        size="xxlarge"
        onClose={() => {
          setStockModalOpen(false);
          setSelectedStock(null);
          setReserveQty(1);
          setStockQuery('');
          setStockSkuQuery('');
          setStockColorQuery('');
          setQtyInputOpen(false);
          setTempSelectedItem(null);
        }}
        actions={
          <>
            <div style={{ flex: 1, textAlign: 'left', fontSize: 13, color: 'var(--text-muted)' }}>
              {reservedLines.length > 0 && `✅ ${reservedLines.length} kalem seçildi`}
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => setStockModalOpen(false)}>
              İptal
            </button>
            <button
              className="btn btn-success"
              type="button"
              onClick={() => {
                setStockModalOpen(false);
                setStockQuery('');
                setStockSkuQuery('');
                setStockColorQuery('');
              }}
              disabled={reservedLines.length === 0}
            >
              ✓ Seçimi Tamamla ({reservedLines.length} kalem)
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 550 }}>
          {/* Üst Kısım: Hızlı Arama + Filtreler */}
          <div style={{ 
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
            padding: 16, 
            borderRadius: 12,
            border: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <span style={{ fontWeight: 600 }}>Hızlı Ürün Ara</span>
              <span className="text-muted" style={{ fontSize: 12 }}>(Ürüne tıklayarak sepete ekle)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Ürün Adı / Tedarikçi</label>
            <input
              id="stock-search-modal"
                  className="form-input"
                  placeholder="Ürün ara..."
              value={stockQuery}
              onChange={(e) => setStockQuery(e.target.value)}
                  autoFocus
                  style={{ fontSize: 14, padding: '10px 14px' }}
            />
          </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Ürün Kodu</label>
            <input
                  className="form-input"
                  placeholder="Kod..."
              value={stockSkuQuery}
              onChange={(e) => setStockSkuQuery(e.target.value)}
                  style={{ fontSize: 14, padding: '10px 14px' }}
            />
          </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Renk Kodu</label>
            <input
                  className="form-input"
                  placeholder="Renk..."
              value={stockColorQuery}
              onChange={(e) => setStockColorQuery(e.target.value)}
                  style={{ fontSize: 14, padding: '10px 14px' }}
            />
          </div>
              {(stockQuery || stockSkuQuery || stockColorQuery) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setStockQuery('');
                    setStockSkuQuery('');
                    setStockColorQuery('');
                  }}
                  style={{ height: 44 }}
                >
                  Temizle
                </button>
              )}
            </div>
          </div>

          {/* Ana İçerik: Seçilenler + Stok Listesi Yan Yana */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
            {/* Sol: Seçilen Ürünler (Ana Alan) */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: 8 
              }}>
                <h4 style={{ margin: 0, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🛒 Seçilen Ürünler
                  {reservedLines.length > 0 && (
                    <span className="badge badge-success">{reservedLines.length}</span>
                  )}
                </h4>
                {reservedLines.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => setReservedLines([])}
                  >
                    Tümünü Temizle
                  </button>
                )}
              </div>
              
              <div style={{ 
                flex: 1, 
                border: '2px dashed var(--color-border)', 
                borderRadius: 12, 
                overflow: 'hidden',
                background: reservedLines.length === 0 ? 'var(--color-bg-secondary)' : 'var(--color-bg)'
              }}>
                {reservedLines.length === 0 ? (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    padding: 40,
                    color: 'var(--color-text-light)'
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Henüz ürün seçilmedi</div>
                    <div style={{ fontSize: 13, textAlign: 'center' }}>
                      Sağ taraftaki listeden ürünlere tıklayarak<br/>sepete ekleyebilirsiniz
                    </div>
                  </div>
                ) : (
                  <div style={{ maxHeight: 380, overflow: 'auto' }}>
                    <table className="table" style={{ fontSize: 13 }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 1 }}>
                        <tr>
                          <th>Ürün</th>
                          <th style={{ width: '15%' }}>Kod</th>
                          <th style={{ width: '10%' }}>Renk</th>
                          <th style={{ width: '15%' }}>Miktar</th>
                          <th style={{ width: '10%' }}>Stok</th>
                          <th style={{ width: '8%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {reservedLines.map((line) => {
                          const hasIssue = line.qty > (line.available || 0);
                          const usesReserved = line.qty > (line.available || 0) && line.qty <= (line.onHand || 0);
                          return (
                            <tr 
                              key={line.id}
                              style={{ 
                                background: hasIssue 
                                  ? usesReserved 
                                    ? 'rgba(251, 191, 36, 0.1)' 
                                    : 'rgba(239, 68, 68, 0.1)' 
                                  : 'transparent' 
                              }}
                            >
                              <td>
                                <div style={{ fontWeight: 600 }}>{line.name}</div>
                                {line.colorName && <div className="text-muted" style={{ fontSize: 11 }}>{line.colorName}</div>}
                              </td>
                              <td><code style={{ fontSize: 11 }}>{line.productCode}</code></td>
                              <td><span className="badge badge-secondary" style={{ fontSize: 11 }}>{line.colorCode || '-'}</span></td>
                              <td>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ 
                                    width: 70, 
                                    padding: '4px 8px', 
                                    fontSize: 13, 
                                    textAlign: 'center',
                                    border: hasIssue ? '2px solid var(--color-warning)' : undefined
                                  }}
                                  value={line.qty}
                                  min="1"
                                  max={line.onHand || 999}
                                  onChange={(e) => {
                                    const newQty = Number(e.target.value);
                                    setReservedLines((prev) =>
                                      prev.map((l) => l.id === line.id ? { ...l, qty: newQty } : l)
                                    );
                                  }}
                                />
                                <span className="text-muted" style={{ fontSize: 11, marginLeft: 4 }}>{line.unit}</span>
                              </td>
                              <td>
                                <span style={{ 
                                  fontSize: 12, 
                                  color: (line.available || 0) >= line.qty 
                                    ? 'var(--color-success)' 
                                    : 'var(--color-warning)' 
                                }}>
                                  {line.available}/{line.onHand}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-small btn-icon"
                                  onClick={() => removeLine(line.id)}
                                  style={{ padding: '4px 8px' }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              {/* Uyarılar */}
              {reservedLines.some((l) => l.qty > (l.available || 0) && l.qty <= (l.onHand || 0)) && (
                <div style={{ 
                  marginTop: 8, 
                  padding: '8px 12px', 
                  background: 'rgba(251, 191, 36, 0.15)', 
                  border: '1px solid var(--color-warning)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--color-warning)'
                }}>
                  ⚠️ Bazı ürünler için başka işlere ait rezerve stok kullanılacak!
                </div>
              )}
              {reservedLines.some((l) => l.qty > (l.onHand || 0)) && (
                <div style={{ 
                  marginTop: 8, 
                  padding: '8px 12px', 
                  background: 'rgba(239, 68, 68, 0.15)', 
                  border: '1px solid var(--color-danger)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--color-danger)'
                }}>
                  ❌ Bazı ürünler için yeterli stok yok! Lütfen miktarları düzeltin.
                </div>
              )}
            </div>

            {/* Sağ: Stok Listesi */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>📋 Stok Listesi</h4>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {filteredStock.length} ürün
                </span>
        </div>

        {stockLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader size="small" text="Stok listesi yükleniyor..." />
                </div>
        ) : stockError ? (
          <div className="card error-card">
            <div className="error-title">Stok alınamadı</div>
            <div className="error-message">{stockError}</div>
          </div>
        ) : (
                <div style={{ 
                  flex: 1, 
                  border: '1px solid var(--color-border)', 
                  borderRadius: 12, 
                  overflow: 'hidden' 
                }}>
                  <div style={{ maxHeight: 380, overflow: 'auto' }}>
                    <table className="table" style={{ fontSize: 12 }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 1 }}>
                        <tr>
                          <th>Ürün</th>
                          <th style={{ width: '12%' }}>Kod</th>
                          <th style={{ width: '8%' }}>Renk</th>
                          <th style={{ width: '15%' }}>Stok</th>
                          <th style={{ width: '10%' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr>
                            <td colSpan={5}>
                              <div style={{ padding: 30, textAlign: 'center' }}>
                                <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                                <div style={{ fontWeight: 600 }}>Ürün Bulunamadı</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                          filteredStock.slice(0, 100).map((item) => {
                            const isAlreadyAdded = reservedLines.some((l) => l.id === item.id);
                            const hasReservation = (item.reserved || 0) > 0;
                            const canAdd = (item.onHand || 0) > 0 && !isAlreadyAdded;
                            
                    return (
                              <tr
                                key={item.id}
                                style={{
                                  background: isAlreadyAdded 
                                    ? 'var(--color-success-bg, rgba(34, 197, 94, 0.1))' 
                                    : hasReservation 
                                      ? 'rgba(251, 191, 36, 0.05)' 
                                      : 'transparent',
                                  cursor: canAdd ? 'pointer' : 'not-allowed',
                                  opacity: canAdd ? 1 : 0.6
                                }}
                                onClick={() => canAdd && openQtyInput(item)}
                              >
                                <td>
                                  <div style={{ fontWeight: 600, fontSize: 12 }}>{item.name}</div>
                                  <div className="text-muted" style={{ fontSize: 10 }}>
                                    {item.supplierName || item.supplier || '-'}
                                  </div>
                        </td>
                        <td>
                                  <code style={{ fontSize: 10, padding: '2px 4px' }}>
                                    {item.productCode || item.sku}
                                  </code>
                        </td>
                                <td>
                                  <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                                    {item.colorCode || item.color || '-'}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontSize: 12 }}>
                                    <strong style={{ 
                                      color: (item.available || 0) > 0 
                                        ? 'var(--color-success)' 
                                        : (item.onHand || 0) > 0 
                                          ? 'var(--color-warning)' 
                                          : 'var(--color-danger)' 
                                    }}>
                                      {item.available || 0}
                                    </strong>
                                    <span className="text-muted">/{item.onHand || 0}</span>
                                  </div>
                                  {hasReservation && (
                                    <div style={{ fontSize: 10, color: 'var(--color-warning)' }}>
                                      ⚠️ {item.reserved} res.
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {isAlreadyAdded ? (
                                    <span style={{ color: 'var(--color-success)', fontSize: 16 }}>✅</span>
                                  ) : canAdd ? (
                          <button
                            type="button"
                                      className="btn btn-primary btn-small"
                                      style={{ padding: '4px 8px', fontSize: 11 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openQtyInput(item);
                                      }}
                                    >
                                      + Ekle
                          </button>
                                  ) : (
                                    <span className="text-muted" style={{ fontSize: 10 }}>
                                      {(item.onHand || 0) === 0 ? 'Stok yok' : 'Eklendi'}
                                    </span>
                                  )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
                  </div>
          </div>
        )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Miktar Giriş Popup */}
      <Modal
        open={qtyInputOpen}
        title="Miktar Girin"
        size="small"
        onClose={() => {
          setQtyInputOpen(false);
          setTempSelectedItem(null);
          setTempQty(1);
        }}
        actions={
          <>
            <button 
              className="btn btn-secondary" 
              type="button" 
              onClick={() => {
                setQtyInputOpen(false);
                setTempSelectedItem(null);
              }}
            >
              İptal
            </button>
            <button
              className="btn btn-success"
              type="button"
              onClick={addFromQtyInput}
              disabled={!tempSelectedItem || tempQty <= 0 || tempQty > (tempSelectedItem?.onHand || 0)}
            >
              ➕ Sepete Ekle
            </button>
          </>
        }
      >
        {tempSelectedItem && (
          <div>
            <div style={{ 
              background: 'var(--color-bg-secondary)', 
              padding: 16, 
              borderRadius: 8, 
              marginBottom: 16 
            }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{tempSelectedItem.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <span className="text-muted" style={{ fontSize: 11 }}>Kod: </span>
                  <code>{tempSelectedItem.productCode || tempSelectedItem.sku}</code>
                </div>
                <div>
                  <span className="text-muted" style={{ fontSize: 11 }}>Renk: </span>
                  <span className="badge badge-secondary">{tempSelectedItem.colorCode || '-'}</span>
              </div>
                <div>
                  <span className="text-muted" style={{ fontSize: 11 }}>Kullanılabilir: </span>
                  <strong style={{ color: 'var(--color-success)' }}>{tempSelectedItem.available || 0}</strong>
            </div>
                <div>
                  <span className="text-muted" style={{ fontSize: 11 }}>Fiziksel: </span>
                  <strong>{tempSelectedItem.onHand || 0}</strong>
                </div>
              </div>
            </div>

            {(tempSelectedItem?.reserved || 0) > 0 && (
              <div style={{ 
                background: 'rgba(251, 191, 36, 0.15)', 
                border: '1px solid var(--color-warning)', 
                borderRadius: 8, 
                padding: 12, 
                marginBottom: 16,
                fontSize: 12
              }}>
                <strong style={{ color: 'var(--color-warning)' }}>⚠️ Bu stok rezerve edilmiş!</strong>
                <div className="text-muted">
                  Başka iş için {tempSelectedItem.reserved} adet rezerve. 
                  Yine de kullanabilirsiniz.
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Miktar ({tempSelectedItem.unit || 'adet'})</label>
              <input
                type="number"
                className="form-input"
                value={tempQty}
                onChange={(e) => setTempQty(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tempQty > 0 && tempQty <= (tempSelectedItem?.onHand || 0)) {
                    e.preventDefault();
                    addFromQtyInput();
                  }
                }}
                min="1"
                max={tempSelectedItem?.onHand || 999}
                autoFocus
                style={{ 
                  fontSize: 24, 
                  padding: '16px', 
                  textAlign: 'center',
                  fontWeight: 700
                }}
              />
              {tempQty > (tempSelectedItem?.available || 0) && tempQty <= (tempSelectedItem?.onHand || 0) && (
                <div style={{ color: 'var(--color-warning)', fontSize: 12, marginTop: 8 }}>
                  ⚠️ Rezerve stoktan kullanılacak! ({tempQty - (tempSelectedItem?.available || 0)} adet)
                </div>
              )}
              {tempQty > (tempSelectedItem?.onHand || 0) && (
                <div style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 8 }}>
                  ❌ Stok yetersiz! Maksimum: {tempSelectedItem?.onHand || 0}
                </div>
              )}
              <div className="text-muted" style={{ fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                💡 Enter tuşu ile hızlıca ekleyebilirsiniz
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Sonra Üret Modal - Tarih ve Özet */}
      <Modal
        open={sonraUretModalOpen}
        title="📦 Sonra Üretilecek - Özet"
        size="medium"
        onClose={() => setSonraUretModalOpen(false)}
        actions={
          <>
            <button 
              className="btn btn-secondary" 
              type="button" 
              onClick={() => setSonraUretModalOpen(false)}
            >
              İptal
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={actionLoading || !estimatedDate}
              onClick={() =>
                act(async () => {
                  // Rezervasyon API'sini çağır
                  const reservePayload = {
                    jobId: job.id,
                    items: reservedLines.map((l) => ({ itemId: l.id, qty: l.qty })),
                    reserveType: 'reserve',
                    note: productionNote || 'Sonra üretilecek - Rezerve edildi',
                  };
                  
                  const reserveResult = await bulkReserveStock(reservePayload);
                  
                  // Job status güncelle - seçilen ürünleri ve tahmini tarihi kaydet
                  const stockPayload = {
                    ready: false,
                    purchaseNotes: productionNote || 'Sonra üretilecek - Rezerve edildi',
                    estimatedDate: estimatedDate,
                    items: reservedLines.map((l) => ({
                      id: l.id,
                      name: l.name,
                      productCode: l.productCode,
                      colorCode: l.colorCode,
                      qty: l.qty,
                      unit: l.unit,
                      available: l.available,
                      onHand: l.onHand,
                    })),
                  };
                  const result = await updateStockStatus(job.id, stockPayload);
                  
                  // Eksik ürünler varsa PO oluştur
                  const pending = reservedLines
                    .filter((l) => l.qty > l.available)
                    .map((l) => ({ ...l, missing: l.qty - l.available }));
                  
                  if (pending.length > 0) {
                    const po = createLocalPurchaseOrders(job.id, pending);
                    applyLocalJobPatch(job.id, { pendingPO: pending, estimatedDate });
                    setPendingPO(pending);
                    await pushLog('stock_reserved', 'Stok rezerve edildi - Sonra üretilecek', {
                      reserved: reservedLines,
                      pending: pending,
                      estimatedDate,
                      poId: po?.id,
                    });
                  } else {
                    applyLocalJobPatch(job.id, { pendingPO: [], estimatedDate });
                    setPendingPO([]);
                    await pushLog('stock_reserved', 'Stok rezerve edildi', { 
                      reserved: reservedLines,
                      estimatedDate 
                    });
                  }
                  
                  // Lokal stok state'i güncelle
                  if (reserveResult.results) {
                    setStockItems((prev) =>
                      prev.map((item) => {
                        const updated = reserveResult.results.find((r) => r.itemId === item.id);
                        if (!updated) return item;
                        return {
                          ...item,
                          onHand: updated.newOnHand,
                          reserved: updated.newReserved,
                          available: updated.available,
                        };
                      })
                    );
                  }
                  
                  setReservedLines([]);
                  setSonraUretModalOpen(false);
                  return result;
                })
              }
            >
              {actionLoading ? '⏳ İşleniyor...' : '✓ Rezerve Et ve Kaydet'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Özet Bilgi */}
          <div style={{ 
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
            padding: 16, 
            borderRadius: 12,
            border: '1px solid #f59e0b'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>📦</span>
              <span style={{ fontWeight: 700 }}>Sonra Üretilecek</span>
            </div>
            <div style={{ fontSize: 13, color: '#92400e' }}>
              Bu iş için stok rezerve edilecek ve sonra üretilmek üzere bekletilecek.
              İş listesinde "Sonra Üretilecek" durumunda görünecektir.
            </div>
          </div>

          {/* Seçilen Ürünler Özeti */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>
              🛒 Seçilen Ürünler ({reservedLines.length} kalem)
            </h4>
            <div style={{ 
              maxHeight: 150, 
              overflow: 'auto', 
              border: '1px solid var(--color-border)', 
              borderRadius: 8 
            }}>
              <table className="table" style={{ fontSize: 12, marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th style={{ width: '20%' }}>Kod</th>
                    <th style={{ width: '15%' }}>Miktar</th>
                    <th style={{ width: '15%' }}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {reservedLines.map((line) => {
                    const hasIssue = line.qty > (line.available || 0);
                    return (
                      <tr key={line.id}>
                        <td style={{ fontWeight: 600 }}>{line.name}</td>
                        <td><code style={{ fontSize: 10 }}>{line.productCode}</code></td>
                        <td>{line.qty} {line.unit}</td>
                        <td>
                          {hasIssue ? (
                            <span style={{ color: 'var(--color-warning)', fontSize: 11 }}>
                              ⚠️ {line.qty - (line.available || 0)} eksik
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-success)', fontSize: 11 }}>✅ Yeterli</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tahmini Hazır Olma Tarihi */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">
              📅 Tahmini Hazır Olma Tarihi <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="date"
              className="form-input"
              value={estimatedDate}
              onChange={(e) => setEstimatedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ fontSize: 16, padding: 12 }}
            />
            <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
              Bu tarih, işin ne zaman üretime alınabileceğini gösterir
            </div>
          </div>

          {/* Not */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">📝 Not (Opsiyonel)</label>
            <textarea
              className="form-input"
              value={productionNote}
              onChange={(e) => setProductionNote(e.target.value)}
              placeholder="Örn: Müşteri talebiyle ertelendi, Malzeme bekliyor..."
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
      </Modal>

      {isStageSelected('production') && (
        <div className="card">
          {/* Salt Okunur Banner */}
          {isReadOnly && (
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              borderBottom: '1px solid var(--color-border)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#475569'
            }}>
              <span style={{ fontSize: 18 }}>📂</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Arşiv Görünümü</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Bu aşama tamamlandı. Sadece görüntüleme modundasınız.</div>
              </div>
            </div>
          )}
          <div className="card-header">
            <h3 className="card-title">🏭 Üretim & Tedarik Takip</h3>
          </div>
          <div className="card-body" style={{ gap: 12 }}>
            {/* Özet Kartları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{productionOrders.summary?.totalOrders || 0}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Toplam Sipariş</div>
              </div>
              <div style={{ background: 'rgba(var(--warning-rgb), 0.1)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--warning)' }}>
                  {productionOrders.summary?.totalItems - productionOrders.summary?.receivedItems || 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bekleyen Adet</div>
              </div>
              <div style={{ background: 'rgba(var(--danger-rgb), 0.1)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger)' }}>
                  {productionOrders.summary?.pendingIssues || 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sorun</div>
              </div>
              <div style={{ 
                background: productionOrders.summary?.readyForAssembly ? 'rgba(var(--success-rgb), 0.15)' : 'var(--bg-secondary)', 
                padding: '0.75rem', borderRadius: '8px', textAlign: 'center',
                border: productionOrders.summary?.readyForAssembly ? '2px solid var(--success)' : 'none'
              }}>
                <div style={{ fontSize: '1.25rem' }}>
                  {productionOrders.summary?.readyForAssembly ? '✅' : '⏳'}
                </div>
                <div style={{ fontSize: '0.7rem', color: productionOrders.summary?.readyForAssembly ? 'var(--success)' : 'var(--text-muted)' }}>
                  {productionOrders.summary?.readyForAssembly ? 'Montaja Hazır' : 'Bekleniyor'}
                </div>
              </div>
            </div>

            {/* İş Kolları Bazlı Hızlı Sipariş */}
            {!isReadOnly && job.roles?.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                  📋 İş Kolları - Hızlı Sipariş
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {job.roles.map((role) => {
                    const roleConfig = roleConfigs.find(rc => rc.id === role.id || rc.name === role.name);
                    // Önce role'dan, yoksa roleConfig'ten al
                    const productionType = role.productionType || roleConfig?.productionType || 'internal';
                    const isInternal = productionType === 'internal';
                    const requiresGlass = role.requiresGlass !== undefined ? role.requiresGlass : (roleConfig?.requiresGlass || false);
                    
                    // Bu iş kolu için mevcut siparişler
                    const roleOrders = productionOrders.orders?.filter(o => o.roleId === role.id) || [];
                    const hasProductionOrder = roleOrders.some(o => o.orderType === 'internal' || o.orderType === 'external');
                    const hasGlassOrder = roleOrders.some(o => o.orderType === 'glass');
                    const allDone = hasProductionOrder && (!requiresGlass || hasGlassOrder);
                    
                    return (
                      <div
                        key={role.id || role.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          background: allDone ? 'rgba(var(--success-rgb), 0.05)' : 'var(--bg-secondary)',
                          borderRadius: '8px',
                          borderLeft: `4px solid ${allDone ? 'var(--success)' : (isInternal ? 'var(--primary)' : 'var(--warning)')}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {role.name}
                              {allDone && <span style={{ color: 'var(--success)' }}>✓</span>}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {isInternal ? '🏭 İç Üretim' : '📦 Dış Sipariş'}
                              {requiresGlass && <span> • 🪟 Cam Gerekli</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {hasProductionOrder && (
                              <span className="badge badge-primary" style={{ fontSize: '0.6rem' }}>📦 Üretim Siparişi</span>
                            )}
                            {requiresGlass && hasGlassOrder && (
                              <span className="badge badge-info" style={{ fontSize: '0.6rem' }}>🪟 Cam Siparişi</span>
                            )}
                          </div>
                        </div>
                        <div>
                          {!allDone && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={async () => {
                                // Önce verileri yükle (cam tipleri, tedarikçiler)
                                await loadProductionData();
                                
                                const prodEstDate = new Date();
                                prodEstDate.setDate(prodEstDate.getDate() + (roleConfig?.estimatedDays || 5));
                                const glassEstDate = new Date();
                                glassEstDate.setDate(glassEstDate.getDate() + 7);
                                
                                // Üretim tedarikçisi
                                let prodSuppId = '', prodSuppName = '';
                                if (!isInternal && roleConfig?.defaultSupplier) {
                                  const supp = suppliersList.find(s => s.id === roleConfig.defaultSupplier);
                                  if (supp) { prodSuppId = supp.id; prodSuppName = supp.name; }
                                }
                                
                                // Cam tedarikçisi
                                let glassSuppId = '', glassSuppName = '';
                                if (requiresGlass && roleConfig?.defaultGlassSupplier) {
                                  const supp = suppliersList.find(s => s.id === roleConfig.defaultGlassSupplier);
                                  if (supp) { glassSuppId = supp.id; glassSuppName = supp.name; }
                                }
                                
                                setProdOrderForm({
                                  roleId: role.id || '', 
                                  roleName: role.name || '',
                                  // Üretim
                                  productionType: isInternal ? 'internal' : 'external',
                                  productionDescription: '',
                                  productionQty: 1,
                                  productionUnit: 'adet',
                                  productionEstDelivery: prodEstDate.toISOString().slice(0, 10),
                                  productionNotes: '',
                                  productionSupplierId: prodSuppId,
                                  productionSupplierName: prodSuppName,
                                  // Cam
                                  requiresGlass: requiresGlass || false,
                                  includeGlass: requiresGlass && !hasGlassOrder,
                                  glassItems: [{ glassType: '', glassName: '', quantity: 1, combination: '' }],
                                  glassSupplierId: glassSuppId,
                                  glassSupplierName: glassSuppName,
                                  glassEstDelivery: glassEstDate.toISOString().slice(0, 10),
                                  // Zaten varsa sadece cam siparişi göster
                                  skipProduction: hasProductionOrder,
                                });
                                setShowProdOrderModal(true);
                              }}
                            >
                              {hasProductionOrder ? '🪟 Cam Sipariş Geç' : '📋 Sipariş Oluştur'}
                            </button>
                          )}
                          {allDone && (
                            <span className="badge badge-success">✅ Siparişler Verildi</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sipariş Listesi */}
            {productionOrdersLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Yükleniyor...</div>
            ) : productionOrders.orders?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Henüz sipariş yok</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Yukarıdan iş kollarına göre sipariş oluşturabilirsiniz
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {productionOrders.orders.map((order) => {
                  const totalQty = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
                  const receivedQty = order.items?.reduce((s, i) => s + (i.receivedQty || 0), 0) || 0;
                  const pendingIssues = order.issues?.filter(i => i.status === 'pending').length || 0;
                  const typeColors = { internal: 'var(--success)', external: 'var(--warning)', glass: 'var(--info)' };
                  const typeLabels = { internal: '🏭 İç Üretim', external: '📦 Dış Sipariş', glass: '🪟 Cam' };
                  
                  return (
                    <div
                      key={order.id}
                      style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        borderLeft: `4px solid ${typeColors[order.orderType] || 'var(--border-color)'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{order.roleName}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {typeLabels[order.orderType]} {order.supplierName && `• ${order.supplierName}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <span className={`badge badge-${order.status === 'completed' ? 'success' : order.status === 'partial' ? 'info' : 'primary'}`}>
                            {order.status === 'completed' ? '✅ Tamamlandı' : order.status === 'partial' ? '🚚 Kısmi Teslim' : '📦 Siparişte'}
                          </span>
                          {order.isOverdue && <span className="badge badge-danger">GECİKTİ</span>}
                          {pendingIssues > 0 && <span className="badge badge-danger">⚠️ {pendingIssues}</span>}
                        </div>
                      </div>
                      
                      {/* Progress */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${totalQty > 0 ? (receivedQty / totalQty) * 100 : 0}%`,
                            height: '100%',
                            background: order.status === 'completed' ? 'var(--success)' : 'var(--primary)',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: '60px' }}>
                          {receivedQty} / {totalQty}
                        </span>
                      </div>
                      
                      {/* Detay & Aksiyonlar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Tahmini: {order.estimatedDelivery ? formatDate(order.estimatedDelivery) : '—'}
                        </div>
                        {!isReadOnly && order.status !== 'completed' && (
                          <button
                            className="btn btn-xs btn-success"
                            onClick={() => {
                              setSelectedProdOrder(order);
                              setDeliveryFormData({
                                deliveries: order.items.map((_, idx) => ({
                                  lineIndex: idx, receivedQty: 0, problemQty: 0, problemType: '', problemNote: ''
                                })),
                                deliveryDate: new Date().toISOString().slice(0, 10),
                                deliveryNote: ''
                              });
                              setShowDeliveryModal(true);
                            }}
                          >
                            📥 Teslim Kaydet
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Montaja Geçiş */}
            {productionOrders.summary?.readyForAssembly && !isReadOnly && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: 'linear-gradient(135deg, rgba(var(--success-rgb), 0.1) 0%, rgba(var(--success-rgb), 0.05) 100%)',
                borderRadius: '8px',
                border: '1px solid var(--success)',
                textAlign: 'center'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--success)' }}>
                  ✅ Tüm siparişler tamamlandı!
                </div>
                <button
                  className="btn btn-success"
                  disabled={actionLoading}
                  onClick={() => act(() => updateProductionStatus(job.id, { status: 'MONTAJA_HAZIR' }), {
                    production: 'MONTAJA_HAZIR'
                  })}
                >
                  🚚 Montaja Geç
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Birleşik Sipariş Oluşturma Modal */}
      <Modal isOpen={showProdOrderModal} onClose={() => setShowProdOrderModal(false)} title={`📋 ${prodOrderForm.roleName || 'Sipariş'} - Sipariş Oluştur`} size="large">
        {/* Üretim Bölümü */}
        {!prodOrderForm.skipProduction && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem',
              padding: '0.5rem 0.75rem', background: prodOrderForm.productionType === 'internal' ? 'rgba(var(--success-rgb), 0.1)' : 'rgba(var(--warning-rgb), 0.1)',
              borderRadius: '6px', borderLeft: `3px solid ${prodOrderForm.productionType === 'internal' ? 'var(--success)' : 'var(--warning)'}`
            }}>
              <span style={{ fontSize: '1.1rem' }}>{prodOrderForm.productionType === 'internal' ? '🏭' : '📦'}</span>
              <span style={{ fontWeight: 600 }}>{prodOrderForm.productionType === 'internal' ? 'İç Üretim' : 'Dış Sipariş'}</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Açıklama</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ör: Villa projesi pencereler..."
                  value={prodOrderForm.productionDescription}
                  onChange={(e) => setProdOrderForm(p => ({ ...p, productionDescription: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Adet</label>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <input
                    type="number"
                    className="form-input"
                    min={1}
                    value={prodOrderForm.productionQty}
                    onChange={(e) => setProdOrderForm(p => ({ ...p, productionQty: parseInt(e.target.value) || 1 }))}
                    style={{ flex: 1 }}
                  />
            <select
              className="form-select"
                    value={prodOrderForm.productionUnit}
                    onChange={(e) => setProdOrderForm(p => ({ ...p, productionUnit: e.target.value }))}
                    style={{ width: '70px' }}
                  >
                    <option value="adet">adet</option>
                    <option value="set">set</option>
                    <option value="m²">m²</option>
            </select>
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Tahmini Teslim</label>
                  <input
                    type="date"
                  className="form-input"
                  value={prodOrderForm.productionEstDelivery}
                  onChange={(e) => setProdOrderForm(p => ({ ...p, productionEstDelivery: e.target.value }))}
                  />
                </div>
                </div>
            
            {prodOrderForm.productionType === 'external' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Dış Üretim Tedarikçisi</label>
                  <select
                    className="form-select"
                    value={prodOrderForm.productionSupplierId}
                    onChange={(e) => {
                      const supp = suppliersList.find(s => s.id === e.target.value);
                      setProdOrderForm(p => ({ ...p, productionSupplierId: supp?.id || '', productionSupplierName: supp?.name || '' }));
                    }}
                  >
                    <option value="">Tedarikçi seçin...</option>
                    {suppliersList
                      .filter(s => s.supplyType === 'production' && (s.jobRoleId === prodOrderForm.roleId || !s.jobRoleId))
                      .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
              </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Not</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Opsiyonel notlar..."
                    value={prodOrderForm.productionNotes}
                    onChange={(e) => setProdOrderForm(p => ({ ...p, productionNotes: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Cam Siparişi Bölümü */}
        {prodOrderForm.requiresGlass && (
          <div style={{ 
            padding: '1rem', 
            background: prodOrderForm.includeGlass ? 'rgba(var(--info-rgb), 0.05)' : 'var(--bg-secondary)', 
            borderRadius: '8px',
            border: prodOrderForm.includeGlass ? '1px solid var(--info)' : '1px dashed var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: prodOrderForm.includeGlass ? '1rem' : 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={prodOrderForm.includeGlass}
                  onChange={(e) => setProdOrderForm(p => ({ ...p, includeGlass: e.target.checked }))}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '1.1rem' }}>🪟</span>
                <span style={{ fontWeight: 600 }}>Cam Siparişi Dahil Et</span>
              </label>
              {!prodOrderForm.skipProduction && prodOrderForm.requiresGlass && (
                <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Bu iş kolu için cam gerekli</span>
              )}
            </div>
            
            {prodOrderForm.includeGlass && (
              <>
                {/* Cam Kalemleri */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ margin: 0, fontSize: '0.75rem' }}>Cam Kalemleri</label>
            <button
              type="button"
                      className="btn btn-xs btn-info"
                      onClick={() => setProdOrderForm(p => ({
                        ...p,
                        glassItems: [...p.glassItems, { glassType: '', glassName: '', quantity: 1, combination: '' }]
                      }))}
                    >
                      + Cam Tipi Ekle
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {prodOrderForm.glassItems.map((item, idx) => (
                      <div key={idx} style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr 80px 30px', 
                        gap: '0.5rem', 
                        padding: '0.5rem', 
                        background: 'white', 
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)'
                      }}>
                        <select
                          className="form-select"
                          value={item.glassType}
                          onChange={(e) => {
                            const g = glassTypesList.find(x => x.code === e.target.value);
                            const newItems = [...prodOrderForm.glassItems];
                            newItems[idx] = { ...newItems[idx], glassType: e.target.value, glassName: g?.name || '' };
                            setProdOrderForm(p => ({ ...p, glassItems: newItems }));
                          }}
                          style={{ fontSize: '0.8rem' }}
                        >
                          <option value="">Cam tipi seçin... ({glassTypesList.length} adet)</option>
                          {glassTypesList.map(g => <option key={g.id} value={g.code}>{g.name}</option>)}
                        </select>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Kombinasyon (ör: Sinerji, Low-E)"
                          value={item.combination}
                          onChange={(e) => {
                            const newItems = [...prodOrderForm.glassItems];
                            newItems[idx] = { ...newItems[idx], combination: e.target.value };
                            setProdOrderForm(p => ({ ...p, glassItems: newItems }));
                          }}
                          style={{ fontSize: '0.8rem' }}
                          list="combinationsList"
                        />
                        <input
                          type="number"
                          className="form-input"
                          min={1}
                          placeholder="Adet"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...prodOrderForm.glassItems];
                            newItems[idx] = { ...newItems[idx], quantity: parseInt(e.target.value) || 1 };
                            setProdOrderForm(p => ({ ...p, glassItems: newItems }));
                          }}
                          style={{ fontSize: '0.8rem', textAlign: 'center' }}
                        />
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost"
              onClick={() => {
                            if (prodOrderForm.glassItems.length > 1) {
                              setProdOrderForm(p => ({ ...p, glassItems: p.glassItems.filter((_, i) => i !== idx) }));
                            }
                          }}
                          style={{ color: 'var(--danger)' }}
                          disabled={prodOrderForm.glassItems.length === 1}
                        >
                          🗑️
            </button>
                </div>
                    ))}
                        </div>
                  <datalist id="combinationsList">
                    {combinationsList.map((c, i) => <option key={i} value={c} />)}
                  </datalist>
                      </div>
                
                {/* Cam Tedarikçi ve Teslim */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Cam Tedarikçisi</label>
                    <select
                      className="form-select"
                      value={prodOrderForm.glassSupplierId}
                      onChange={(e) => {
                        const supp = suppliersList.find(s => s.id === e.target.value);
                        setProdOrderForm(p => ({ ...p, glassSupplierId: supp?.id || '', glassSupplierName: supp?.name || '' }));
                      }}
                    >
                      <option value="">Tedarikçi seçin...</option>
                      {suppliersList
                        .filter(s => s.supplyType === 'glass' && (s.jobRoleId === prodOrderForm.roleId || !s.jobRoleId))
                        .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Tahmini Cam Teslimi</label>
                    <input
                      type="date"
                      className="form-input"
                      value={prodOrderForm.glassEstDelivery}
                      onChange={(e) => setProdOrderForm(p => ({ ...p, glassEstDelivery: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}
              </div>
        )}
        
        {/* Özet */}
        <div style={{ 
          marginTop: '1.5rem', 
          padding: '0.75rem', 
          background: 'var(--bg-secondary)', 
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong>Oluşturulacak:</strong>{' '}
            {!prodOrderForm.skipProduction && <span className="badge badge-primary" style={{ marginRight: '0.25rem' }}>1x Üretim</span>}
            {prodOrderForm.includeGlass && <span className="badge badge-info">1x Cam Siparişi ({prodOrderForm.glassItems.reduce((s, i) => s + (i.quantity || 0), 0)} adet)</span>}
            {prodOrderForm.skipProduction && !prodOrderForm.includeGlass && <span style={{ color: 'var(--danger)' }}>Hiçbir şey seçilmedi</span>}
                </div>
                </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-ghost" onClick={() => setShowProdOrderModal(false)}>İptal</button>
          <button
            className="btn btn-primary"
            disabled={actionLoading || (!prodOrderForm.skipProduction && !prodOrderForm.productionDescription) || (prodOrderForm.skipProduction && !prodOrderForm.includeGlass)}
            onClick={async () => {
              try {
                setActionLoading(true);
                const promises = [];
                
                // Üretim siparişi oluştur
                if (!prodOrderForm.skipProduction) {
                  promises.push(createProductionOrder({
                    jobId: job.id,
                    roleId: prodOrderForm.roleId,
                    roleName: prodOrderForm.roleName,
                    orderType: prodOrderForm.productionType,
                    supplierId: prodOrderForm.productionSupplierId,
                    supplierName: prodOrderForm.productionSupplierName,
                    items: [{ 
                      notes: prodOrderForm.productionDescription, 
                      quantity: prodOrderForm.productionQty, 
                      unit: prodOrderForm.productionUnit 
                    }],
                    estimatedDelivery: prodOrderForm.productionEstDelivery,
                    notes: prodOrderForm.productionNotes,
                  }));
                }
                
                // Cam siparişi oluştur
                if (prodOrderForm.includeGlass && prodOrderForm.glassItems.length > 0) {
                  promises.push(createProductionOrder({
                    jobId: job.id,
                    roleId: prodOrderForm.roleId,
                    roleName: prodOrderForm.roleName,
                    orderType: 'glass',
                    supplierId: prodOrderForm.glassSupplierId,
                    supplierName: prodOrderForm.glassSupplierName,
                    items: prodOrderForm.glassItems.map(gi => ({
                      glassType: gi.glassType,
                      glassName: gi.glassName,
                      quantity: gi.quantity,
                      unit: 'adet',
                      combination: gi.combination,
                    })),
                    estimatedDelivery: prodOrderForm.glassEstDelivery,
                    notes: '',
                  }));
                }
                
                await Promise.all(promises);
                
                const ordersData = await getProductionOrdersByJob(job.id);
                setProductionOrders(ordersData || { orders: [], summary: {} });
                
                // Tüm iş kollarının siparişleri verildi mi kontrol et
                const allRolesHaveOrders = (job.roles || []).every(role => {
                  const roleId = role.id || `role-${role.name}`;
                  const roleOrders = (ordersData?.orders || []).filter(o => o.roleId === roleId || o.roleName === role.name);
                  const roleConfig = roleConfigs.find(rc => rc.id === roleId || rc.name === role.name);
                  const hasProduction = roleOrders.some(o => o.orderType === 'internal' || o.orderType === 'external');
                  const hasGlass = roleOrders.some(o => o.orderType === 'glass');
                  const requiresGlass = roleConfig?.requiresGlass || role.requiresGlass;
                  return hasProduction && (!requiresGlass || hasGlass);
                });
                
                // Tüm siparişler verildiyse iş durumunu güncelle
                if (allRolesHaveOrders && job.status === 'URETIME_HAZIR') {
                  await updateJobStatus(job.id, { status: 'URETIMDE' });
                  applyLocalJobPatch(job.id, { status: 'URETIMDE' });
                }
                
                setShowProdOrderModal(false);
              } catch (err) {
                setActionError(toMessage(err));
              } finally {
                setActionLoading(false);
              }
            }}
          >
            {actionLoading ? 'Kaydediliyor...' : `✓ Siparişleri Oluştur`}
          </button>
              </div>
      </Modal>

      {/* Teslim Kaydet Modal */}
      <Modal isOpen={showDeliveryModal} onClose={() => setShowDeliveryModal(false)} title={`Teslim Kaydet - ${selectedProdOrder?.roleName || ''}`} size="large">
        {selectedProdOrder && (
          <>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <div><strong>İş Kolu:</strong> {selectedProdOrder.roleName}</div>
              {selectedProdOrder.supplierName && <div><strong>Tedarikçi:</strong> {selectedProdOrder.supplierName}</div>}
          </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="date"
                className="form-input"
                value={deliveryFormData.deliveryDate}
                onChange={(e) => setDeliveryFormData(p => ({ ...p, deliveryDate: e.target.value }))}
                style={{ width: '150px' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setDeliveryFormData(p => ({
                    ...p,
                    deliveries: p.deliveries.map((d, idx) => ({
                      ...d,
                      receivedQty: Math.max(0, (selectedProdOrder.items[idx]?.quantity || 0) - (selectedProdOrder.items[idx]?.receivedQty || 0))
                    }))
                  }));
                }}
              >
                Tümünü Doldur
              </button>
        </div>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Kalem</th>
                    <th style={{ width: '70px' }}>Sipariş</th>
                    <th style={{ width: '70px' }}>Alınan</th>
                    <th style={{ width: '70px' }}>Teslim</th>
                    <th style={{ width: '70px' }}>Sorunlu</th>
                    <th style={{ width: '100px' }}>Sorun Tipi</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProdOrder.items.map((item, idx) => {
                    const remaining = (item.quantity || 0) - (item.receivedQty || 0);
                    const delivery = deliveryFormData.deliveries[idx] || {};
                    return (
                      <tr key={idx}>
                        <td>
                          {item.glassName || item.notes || `Kalem ${idx + 1}`}
                          {item.combination && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.combination}</div>}
                        </td>
                        <td>{item.quantity} {item.unit}</td>
                        <td style={{ color: remaining === 0 ? 'var(--success)' : 'inherit' }}>{item.receivedQty || 0}</td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            value={delivery.receivedQty || ''}
                            onChange={(e) => {
                              const newDels = [...deliveryFormData.deliveries];
                              newDels[idx] = { ...newDels[idx], receivedQty: parseInt(e.target.value) || 0 };
                              setDeliveryFormData(p => ({ ...p, deliveries: newDels }));
                            }}
                            min={0}
                            max={remaining}
                            style={{ width: '60px', padding: '0.25rem', textAlign: 'center' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            value={delivery.problemQty || ''}
                            onChange={(e) => {
                              const newDels = [...deliveryFormData.deliveries];
                              newDels[idx] = { ...newDels[idx], problemQty: parseInt(e.target.value) || 0 };
                              setDeliveryFormData(p => ({ ...p, deliveries: newDels }));
                            }}
                            min={0}
                            style={{ width: '60px', padding: '0.25rem', textAlign: 'center' }}
                          />
                        </td>
                        <td>
                          {delivery.problemQty > 0 && (
                            <select
                              className="form-select"
                              value={delivery.problemType || ''}
                              onChange={(e) => {
                                const newDels = [...deliveryFormData.deliveries];
                                newDels[idx] = { ...newDels[idx], problemType: e.target.value };
                                setDeliveryFormData(p => ({ ...p, deliveries: newDels }));
                              }}
                              style={{ padding: '0.25rem', fontSize: '0.75rem' }}
                            >
                              <option value="">Seçin...</option>
                              <option value="broken">💔 Kırık</option>
                              <option value="missing">❓ Eksik</option>
                              <option value="wrong">❌ Yanlış</option>
                              <option value="other">⚠️ Diğer</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Teslimat Notu</label>
              <input
                type="text"
                className="form-input"
                value={deliveryFormData.deliveryNote}
                onChange={(e) => setDeliveryFormData(p => ({ ...p, deliveryNote: e.target.value }))}
                placeholder="Opsiyonel not..."
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowDeliveryModal(false)}>İptal</button>
              <button
                className="btn btn-success"
                disabled={actionLoading}
                onClick={async () => {
                  const hasDelivery = deliveryFormData.deliveries.some(d => d.receivedQty > 0 || d.problemQty > 0);
                  if (!hasDelivery) {
                    alert('En az bir teslim miktarı girin');
                    return;
                  }
                  try {
                    setActionLoading(true);
                    await recordProductionDelivery(selectedProdOrder.id, deliveryFormData);
                    const ordersData = await getProductionOrdersByJob(job.id);
                    setProductionOrders(ordersData || { orders: [], summary: {} });
                    setShowDeliveryModal(false);
                  } catch (err) {
                    setActionError(toMessage(err));
                  } finally {
                    setActionLoading(false);
                  }
                }}
              >
                {actionLoading ? 'Kaydediliyor...' : '📥 Teslim Kaydet'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {isStageSelected('assembly') && (
        <div className="card">
          {/* Salt Okunur Banner */}
          {isReadOnly && (
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              borderBottom: '1px solid var(--color-border)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#475569'
            }}>
              <span style={{ fontSize: 18 }}>📂</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Arşiv Görünümü</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Bu aşama tamamlandı. Sadece görüntüleme modundasınız.</div>
              </div>
            </div>
          )}
          <div className="card-header">
            <h3 className="card-title">Montaj Termin</h3>
          </div>
          <div className="card-body grid grid-1" style={{ gap: 12 }}>
            <div className="grid grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Montaj Tarihi</label>
            <input
              className="form-input"
                  type="date"
                  value={inputs.assemblyDate?.split('T')[0] || inputs.assemblyDate || ''}
                  onChange={(e) => {
                    const time = inputs.assemblyTime || '09:00';
                    setInputs((p) => ({ ...p, assemblyDate: e.target.value ? `${e.target.value}T${time}` : '' }));
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Saat</label>
            <input
              className="form-input"
                  type="time"
                  value={inputs.assemblyDate?.includes('T') ? inputs.assemblyDate.split('T')[1]?.slice(0, 5) : '09:00'}
                  onChange={(e) => {
                    const date = inputs.assemblyDate?.split('T')[0] || '';
                    if (date) {
                      setInputs((p) => ({ ...p, assemblyDate: `${date}T${e.target.value}` }));
                    }
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ekip</label>
                <input
                  className="form-input"
                  placeholder="Montaj ekibi"
              value={inputs.assemblyTeam}
              onChange={(e) => setInputs((p) => ({ ...p, assemblyTeam: e.target.value }))}
            />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Montaj Notu</label>
            <textarea
              className="form-textarea"
                placeholder="Montaj notu, adres detayları vb."
              value={inputs.assemblyNote}
              onChange={(e) => setInputs((p) => ({ ...p, assemblyNote: e.target.value }))}
            />
            </div>
            <div className="btn-group" style={{ gap: 8 }}>
            <button
                className="btn btn-secondary"
              type="button"
              disabled={actionLoading}
              onClick={() =>
                act(() =>
                  scheduleAssembly(job.id, {
                    date: inputs.assemblyDate,
                    note: inputs.assemblyNote,
                    team: inputs.assemblyTeam,
                  })
                )
              }
            >
                Termin Kaydet
              </button>
              <button
                className="btn btn-success"
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  act(async () => {
                    const result = await completeAssembly(job.id, {
                      date: inputs.assemblyDate,
                      note: inputs.assemblyNote,
                      team: inputs.assemblyTeam,
                      completed: true,
                    });
                    await pushLog('assembly.completed', 'Montaj tamamlandı', { team: inputs.assemblyTeam });
                    return result;
                  })
                }
              >
                ✓ Montaj Bitti
            </button>
            </div>
          </div>
        </div>
      )}

      {isStageSelected('finance') && (
        <div className="card">
          {/* Salt Okunur Banner */}
          {isReadOnly && (
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              borderBottom: '1px solid var(--color-border)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#475569'
            }}>
              <span style={{ fontSize: 18 }}>📂</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Arşiv Görünümü</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Bu aşama tamamlandı. Sadece görüntüleme modundasınız.</div>
              </div>
            </div>
          )}
          <div className="card-header">
            <h3 className="card-title">Son Mutabakat (Kapanış)</h3>
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            {/* Teklif Özeti */}
            <div className="card subtle-card">
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <h4 className="card-title" style={{ fontSize: 14 }}>Finansal Özet</h4>
              </div>
              <div className="card-body" style={{ padding: 16 }}>
                <div className="grid grid-2" style={{ gap: 16 }}>
                  <div>
                    <div className="metric-row">
                      <span className="metric-label">Teklif Tutarı</span>
                      <span className="metric-value">{formatNumber(offerTotalValue)} ₺</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Ön Alınan</span>
                      <span className="metric-value">
                        {formatNumber(
                          Number(job.approval?.paymentPlan?.cash || 0) +
                          Number(job.approval?.paymentPlan?.card || 0) +
                          Number(job.approval?.paymentPlan?.cheque || 0)
                        )} ₺
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Teslimat Sonrası</span>
                      <span className="metric-value">{formatNumber(Number(job.approval?.paymentPlan?.afterDelivery || 0))} ₺</span>
                    </div>
                  </div>
                  <div>
                    <div className="metric-row">
                      <span className="metric-label">Beklenen Toplam</span>
                      <span className="metric-value">
                        {formatNumber(
                          Number(job.approval?.paymentPlan?.cash || 0) +
                          Number(job.approval?.paymentPlan?.card || 0) +
                          Number(job.approval?.paymentPlan?.cheque || 0) +
                          Number(job.approval?.paymentPlan?.afterDelivery || 0)
                        )} ₺
                      </span>
                    </div>
                    {offerTotalValue !== (
                      Number(job.approval?.paymentPlan?.cash || 0) +
                      Number(job.approval?.paymentPlan?.card || 0) +
                      Number(job.approval?.paymentPlan?.cheque || 0) +
                      Number(job.approval?.paymentPlan?.afterDelivery || 0)
                    ) && (
                      <div className="badge badge-warning" style={{ marginTop: 8 }}>
                        Ödeme planı teklif tutarıyla eşleşmiyor!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Gerçekleşen Tahsilat */}
            <div className="card subtle-card">
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <h4 className="card-title" style={{ fontSize: 14 }}>İş Bitiminde Alınan Tutar</h4>
              </div>
              <div className="card-body" style={{ padding: 16 }}>
                <div className="grid grid-4" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Nakit</label>
                    <CurrencyInput
                      placeholder="0"
              value={inputs.financeCash}
                      onChange={(val) => setInputs((p) => ({ ...p, financeCash: val }))}
            />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kredi Kartı</label>
                    <CurrencyInput
                      placeholder="0"
              value={inputs.financeCard}
                      onChange={(val) => setInputs((p) => ({ ...p, financeCard: val }))}
            />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Çek</label>
                    <CurrencyInput
                      placeholder="0"
              value={inputs.financeCheque}
                      onChange={(val) => setInputs((p) => ({ ...p, financeCheque: val }))}
            />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Toplam Alınan</label>
                    <div className="form-input" style={{ background: '#f9fafb', display: 'flex', alignItems: 'center' }}>
                      {formatNumber(
                        Number(inputs.financeCash || 0) +
                        Number(inputs.financeCard || 0) +
                        Number(inputs.financeCheque || 0)
                      )} ₺
                    </div>
                  </div>
                </div>

                {/* Bakiye Kontrolü */}
                {(() => {
                  const preReceived =
                    Number(job.approval?.paymentPlan?.cash || 0) +
                    Number(job.approval?.paymentPlan?.card || 0) +
                    Number(job.approval?.paymentPlan?.cheque || 0);
                  const finishReceived =
                    Number(inputs.financeCash || 0) +
                    Number(inputs.financeCard || 0) +
                    Number(inputs.financeCheque || 0);
                  const discount = Number(inputs.discountAmount || 0);
                  const total = preReceived + finishReceived + discount;
                  const diff = offerTotalValue - total;
                  
                  return (
                    <div style={{ marginTop: 12, padding: 12, background: diff === 0 ? '#ecfdf5' : '#fef2f2', borderRadius: 8 }}>
                      <div className="metric-row">
                        <span className="metric-label">Ön Alınan</span>
                        <span>{formatNumber(preReceived)} ₺</span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">Şimdi Alınan</span>
                        <span>{formatNumber(finishReceived)} ₺</span>
                      </div>
                      {discount > 0 && (
                        <div className="metric-row">
                          <span className="metric-label">İskonto</span>
                          <span>{formatNumber(discount)} ₺</span>
                        </div>
                      )}
                      <hr style={{ margin: '8px 0', borderColor: 'rgba(0,0,0,0.1)' }} />
                      <div className="metric-row">
                        <span className="metric-label" style={{ fontWeight: 700 }}>Toplam</span>
                        <span style={{ fontWeight: 700 }}>{formatNumber(total)} ₺</span>
                      </div>
                      <div className="metric-row" style={{ color: diff === 0 ? '#059669' : '#dc2626' }}>
                        <span className="metric-label">Bakiye Farkı</span>
                        <span style={{ fontWeight: 700 }}>{diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff)} ₺</span>
                      </div>
                      {diff !== 0 && (
                        <div className="badge badge-danger" style={{ marginTop: 8 }}>
                          {diff > 0 ? 'Eksik tahsilat!' : 'Fazla tahsilat!'}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* İskonto */}
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">İskonto Tutarı (opsiyonel)</label>
                <CurrencyInput
                  placeholder="0"
              value={inputs.discountAmount}
                  onChange={(val) => setInputs((p) => ({ ...p, discountAmount: val }))}
            />
              </div>
              <div className="form-group">
                <label className="form-label">İskonto Notu</label>
            <input
              className="form-input"
                  placeholder="İskonto sebebi"
              value={inputs.discountNote}
              onChange={(e) => setInputs((p) => ({ ...p, discountNote: e.target.value }))}
            />
              </div>
            </div>

            <button
              className="btn btn-success"
              type="button"
              disabled={actionLoading}
              onClick={() =>
                act(() =>
                  closeFinance(job.id, {
                    total: Number(inputs.financeTotal || offerTotalValue),
                    payments: {
                      cash: Number(inputs.financeCash || 0),
                      card: Number(inputs.financeCard || 0),
                      cheque: Number(inputs.financeCheque || 0),
                    },
                    discount:
                      Number(inputs.discountAmount || 0) > 0
                        ? { amount: Number(inputs.discountAmount || 0), note: inputs.discountNote || '' }
                        : null,
                  })
                )
              }
            >
              İşi Kapat (Bakiye 0 olmalı)
            </button>
          </div>
        </div>
      )}

      {/* SERVİS AŞAMALARI */}
      {isServiceJob && isStageSelected('service_schedule') && (
        <div className="card">
          {/* Salt Okunur Banner */}
          {isReadOnly && (
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              borderBottom: '1px solid var(--color-border)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#475569'
            }}>
              <span style={{ fontSize: 18 }}>📂</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Arşiv Görünümü</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Bu aşama tamamlandı. Sadece görüntüleme modundasınız.</div>
              </div>
            </div>
          )}
          <div className="card-header">
            <h3 className="card-title">📅 Servis Randevusu</h3>
            <span className="badge badge-warning">Randevu Belirlenmedi</span>
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            {/* Müşteri Bilgisi */}
            <div className="card subtle-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{job.title}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-muted" style={{ fontSize: 12 }}>İş Kodu</div>
                  <div style={{ fontWeight: 600 }}>{job.id}</div>
                </div>
              </div>
            </div>

            {/* Randevu Bilgileri */}
            <div className="grid grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">📅 Randevu Tarihi *</label>
                <input
                  className="form-input"
                  type="date"
                  value={inputs.serviceAppointmentDate || ''}
                  onChange={(e) => setInputs((p) => ({ ...p, serviceAppointmentDate: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">⏰ Saat *</label>
                <input
                  className="form-input"
                  type="time"
                  value={inputs.serviceAppointmentTime || '10:00'}
                  onChange={(e) => setInputs((p) => ({ ...p, serviceAppointmentTime: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">💰 Sabit Servis Ücreti (₺) *</label>
                <CurrencyInput
                  placeholder="Örn: 500"
                  value={inputs.serviceFixedFee || ''}
                  onChange={(val) => setInputs((p) => ({ ...p, serviceFixedFee: val }))}
                />
              </div>
            </div>

            {/* Müşteri Notu */}
            <div className="form-group">
              <label className="form-label">📝 Müşteri Talebi / Adres / Not</label>
              <textarea
                className="form-textarea"
                placeholder="Müşterinin şikayeti, servis adresi, özel notlar..."
                rows={3}
                value={inputs.serviceNote || ''}
                onChange={(e) => setInputs((p) => ({ ...p, serviceNote: e.target.value }))}
              />
            </div>

            {/* Uyarı */}
            {(!inputs.serviceAppointmentDate || !inputs.serviceFixedFee) && (
              <div style={{ padding: 12, background: 'var(--color-warning-bg)', borderRadius: 8, fontSize: 13 }}>
                ⚠️ Randevu tarihi ve servis ücreti zorunludur.
              </div>
            )}

            {/* Tek Buton - Kaydet ve İlerle */}
            <button
              className="btn btn-success"
              type="button"
              style={{ padding: '14px 24px', fontSize: 16 }}
              disabled={actionLoading || !inputs.serviceAppointmentDate || !inputs.serviceFixedFee}
              onClick={() =>
                act(
                  () =>
                    updateJobStatus(job.id, {
                      status: 'SERVIS_RANDEVULU',
                      service: {
                        ...job.service,
                        fixedFee: Number(inputs.serviceFixedFee || 0),
                        note: inputs.serviceNote,
                        visits: [{
                          id: 1,
                          appointmentDate: inputs.serviceAppointmentDate,
                          appointmentTime: inputs.serviceAppointmentTime || '10:00',
                          status: 'scheduled'
                        }]
                      },
                    }),
                  { transition: 'SERVIS_RANDEVULU' }
                )
              }
            >
              ✓ Randevuyu Kaydet ve Onayla
            </button>
          </div>
        </div>
      )}

      {/* SERVİS BAŞLAT - Gidiş Kaydı */}
      {isServiceJob && isStageSelected('service_start') && (
        <div className="card">
          {/* Salt Okunur Banner */}
          {isReadOnly && (
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              borderBottom: '1px solid var(--color-border)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#475569'
            }}>
              <span style={{ fontSize: 18 }}>📂</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Arşiv Görünümü</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Bu aşama tamamlandı. Sadece görüntüleme modundasınız.</div>
              </div>
            </div>
          )}
          <div className="card-header">
            <h3 className="card-title">🚗 Servise Başla</h3>
            <span className="badge badge-primary">Randevu Alındı</span>
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            {/* Randevu Bilgileri */}
            <div className="card subtle-card" style={{ padding: 16 }}>
              <div className="grid grid-3" style={{ gap: 16 }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                  <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 12 }}>RANDEVU</div>
                  <div style={{ fontWeight: 600 }}>
                    {(() => {
                      const currentVisit = job.service?.visits?.find(v => v.status === 'scheduled');
                      if (currentVisit) {
                        return `${new Date(currentVisit.appointmentDate).toLocaleDateString('tr-TR')} ${currentVisit.appointmentTime}`;
                      }
                      return '-';
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 12 }}>SABİT ÜCRET</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatNumber(job.service?.fixedFee || 0)} ₺</div>
                </div>
              </div>
              {job.service?.note && (
                <div style={{ marginTop: 12, padding: 10, background: 'var(--color-warning-bg)', borderRadius: 6 }}>
                  <strong>Not:</strong> {job.service.note}
                </div>
              )}
            </div>

            {/* Gidiş Bilgileri */}
            <div style={{ padding: 16, background: 'var(--color-bg-secondary)', borderRadius: 12 }}>
              <h4 style={{ marginBottom: 12 }}>⏱️ Gidiş Bilgilerini Girin</h4>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Gidiş Tarihi *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={inputs.serviceVisitDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setInputs((p) => ({ ...p, serviceVisitDate: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gidiş Saati *</label>
                  <input
                    className="form-input"
                    type="time"
                    value={inputs.serviceVisitTime || new Date().toTimeString().slice(0, 5)}
                    onChange={(e) => setInputs((p) => ({ ...p, serviceVisitTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <button
              className="btn btn-success"
              type="button"
              style={{ padding: '14px 24px', fontSize: 16 }}
              disabled={actionLoading}
              onClick={() => {
                const visits = [...(job.service?.visits || [])];
                const currentIdx = visits.findIndex(v => v.status === 'scheduled');
                if (currentIdx >= 0) {
                  visits[currentIdx] = {
                    ...visits[currentIdx],
                    visitedAt: `${inputs.serviceVisitDate || new Date().toISOString().split('T')[0]}T${inputs.serviceVisitTime || new Date().toTimeString().slice(0, 5)}`,
                    status: 'in_progress'
                  };
                }
                act(
                  () =>
                    updateJobStatus(job.id, {
                      status: 'SERVIS_YAPILIYOR',
                      service: {
                        ...job.service,
                        visits
                      },
                    }),
                  { transition: 'SERVIS_YAPILIYOR' }
                );
              }}
            >
              🚗 Servise Başla
            </button>
          </div>
        </div>
      )}

      {isServiceJob && isStageSelected('service_work') && (
        <div className="card">
          {/* Salt Okunur Banner */}
          {isReadOnly && (
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              borderBottom: '1px solid var(--color-border)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#475569'
            }}>
              <span style={{ fontSize: 18 }}>📂</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Arşiv Görünümü</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Bu aşama tamamlandı. Sadece görüntüleme modundasınız.</div>
              </div>
            </div>
          )}
          <div className="card-header">
            <h3 className="card-title">🛠️ Servis Çalışması</h3>
            <span className={`badge badge-${job.status === 'SERVIS_DEVAM_EDIYOR' ? 'warning' : 'primary'}`}>
              {job.status === 'SERVIS_DEVAM_EDIYOR' ? 'Devam Ziyareti' : `Ziyaret #${job.service?.visits?.length || 1}`}
            </span>
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            
            {/* Önceki Ziyaretler */}
            {job.service?.visits?.filter(v => v.status === 'completed').length > 0 && (
              <div className="card subtle-card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📜 Önceki Ziyaretler</h4>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {job.service.visits.filter(v => v.status === 'completed').map((visit, idx) => (
                    <div key={visit.id} style={{ 
                      padding: '12px 16px', 
                      borderBottom: '1px solid var(--color-border)',
                      background: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>#{visit.id}</strong> - {new Date(visit.appointmentDate).toLocaleDateString('tr-TR')} {visit.appointmentTime}
                        </div>
                        <span className="badge badge-success">✓ Tamamlandı</span>
                      </div>
                      {visit.visitedAt && (
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                          Gidiş: {new Date(visit.visitedAt).toLocaleString('tr-TR')}
                        </div>
                      )}
                      {visit.workNote && (
                        <div style={{ marginTop: 8, fontSize: 13 }}>
                          <strong>İşlem:</strong> {visit.workNote}
                        </div>
                      )}
                      {visit.materials && (
                        <div style={{ marginTop: 4, fontSize: 13 }}>
                          <strong>Malzeme:</strong> {visit.materials}
                        </div>
                      )}
                      {visit.extraCost > 0 && (
                        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--color-primary)' }}>
                          <strong>Ekstra:</strong> {formatNumber(visit.extraCost)} ₺
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mevcut Ziyaret - Devam Durumu için Yeni Randevu */}
            {job.status === 'SERVIS_DEVAM_EDIYOR' && (
              <div className="card" style={{ border: '2px solid var(--color-warning)', background: 'var(--color-warning-bg)' }}>
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📅 Yeni Randevu Belirle</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="grid grid-3" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Randevu Tarihi *</label>
                      <input
                        className="form-input"
                        type="date"
                        value={inputs.serviceNewAppointmentDate || ''}
                        onChange={(e) => setInputs((p) => ({ ...p, serviceNewAppointmentDate: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Saat *</label>
                      <input
                        className="form-input"
                        type="time"
                        value={inputs.serviceNewAppointmentTime || '10:00'}
                        onChange={(e) => setInputs((p) => ({ ...p, serviceNewAppointmentTime: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gidiş Tarihi</label>
                      <input
                        className="form-input"
                        type="date"
                        value={inputs.serviceVisitDate || ''}
                        onChange={(e) => setInputs((p) => ({ ...p, serviceVisitDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label">Not</label>
                    <input
                      className="form-input"
                      placeholder="Eksik parça, ilave işlem vb..."
                      value={inputs.serviceNewAppointmentNote || ''}
                      onChange={(e) => setInputs((p) => ({ ...p, serviceNewAppointmentNote: e.target.value }))}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    type="button"
                    style={{ marginTop: 12 }}
                    disabled={actionLoading || !inputs.serviceNewAppointmentDate}
                    onClick={() => {
                      const visits = [...(job.service?.visits || [])];
                      const newVisit = {
                        id: visits.length + 1,
                        appointmentDate: inputs.serviceNewAppointmentDate,
                        appointmentTime: inputs.serviceNewAppointmentTime || '10:00',
                        note: inputs.serviceNewAppointmentNote,
                        visitedAt: inputs.serviceVisitDate ? `${inputs.serviceVisitDate}T${inputs.serviceVisitTime || '10:00'}` : null,
                        status: inputs.serviceVisitDate ? 'in_progress' : 'scheduled'
                      };
                      visits.push(newVisit);
                      act(
                        () =>
                          updateJobStatus(job.id, {
                            status: inputs.serviceVisitDate ? 'SERVIS_YAPILIYOR' : 'SERVIS_RANDEVULU',
                            service: { ...job.service, visits }
                          }),
                        { transition: inputs.serviceVisitDate ? 'SERVIS_YAPILIYOR' : 'SERVIS_RANDEVULU' }
                      );
                    }}
                  >
                    {inputs.serviceVisitDate ? '🚗 Randevuyu Kaydet ve Servise Git' : '📅 Randevuyu Kaydet'}
                  </button>
                </div>
              </div>
            )}

            {/* Aktif Ziyaret Detayları */}
            {job.status === 'SERVIS_YAPILIYOR' && (
              <>
                {/* Servis Bilgileri Özeti */}
                <div className="card subtle-card" style={{ padding: 16 }}>
                  <div className="grid grid-3" style={{ gap: 16 }}>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                      <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                    </div>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>SABİT ÜCRET</div>
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatNumber(job.service?.fixedFee || 0)} ₺</div>
                    </div>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>TOPLAM ZİYARET</div>
                      <div style={{ fontWeight: 600 }}>{job.service?.visits?.length || 1}</div>
                    </div>
                  </div>
                  {job.service?.note && (
                    <div style={{ marginTop: 12, padding: 10, background: 'var(--color-warning-bg)', borderRadius: 6 }}>
                      <strong>Müşteri Talebi:</strong> {job.service.note}
                    </div>
                  )}
                </div>

                {/* Yapılan İşlem */}
                <div className="form-group">
                  <label className="form-label">📝 Yapılan İşlem Detayı *</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Servis sırasında yapılan işlemleri detaylı yazın..."
                    rows={3}
                    value={inputs.serviceWorkNote || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, serviceWorkNote: e.target.value }))}
                  />
                </div>

                {/* Malzeme ve Ekstra Maliyet */}
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">🔩 Kullanılan Malzemeler</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Malzeme listesi..."
                      rows={2}
                      value={inputs.serviceMaterials || ''}
                      onChange={(e) => setInputs((p) => ({ ...p, serviceMaterials: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">💰 Bu Ziyaret Ekstra Malzeme Tutarı (₺)</label>
                    <CurrencyInput
                      placeholder="0"
                      value={inputs.serviceExtraCost || ''}
                      onChange={(val) => setInputs((p) => ({ ...p, serviceExtraCost: val }))}
                    />
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                      Sabit ücrete ek malzeme tutarı
                    </div>
                  </div>
                </div>

                {/* Fotoğraflar */}
                <div className="card subtle-card">
                  <div className="card-header" style={{ padding: '12px 16px' }}>
                    <h4 className="card-title" style={{ fontSize: 14 }}>📷 Fotoğraflar (İsteğe Bağlı)</h4>
                    {uploadingDoc && <Loader size="small" />}
                  </div>
                  <div className="card-body" style={{ padding: 16 }}>
                    <div className="grid grid-2" style={{ gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Öncesi</label>
                        <div className="file-upload-zone">
                          <input
                            type="file"
                            id="service-before-photo"
                            accept=".jpg,.jpeg,.png,.gif,.webp"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                await handleDocUpload(file, 'servis_oncesi', 'Servis Öncesi');
                                e.target.value = '';
                              }
                            }}
                          />
                          <label htmlFor="service-before-photo" className="btn btn-secondary btn-small" style={{ cursor: 'pointer' }}>
                            📷 Seç
                          </label>
                          {jobDocuments.some(d => d.type === 'servis_oncesi') && (
                            <span className="badge badge-success" style={{ marginLeft: 8 }}>✓</span>
                          )}
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Sonrası</label>
                        <div className="file-upload-zone">
                          <input
                            type="file"
                            id="service-after-photo"
                            accept=".jpg,.jpeg,.png,.gif,.webp"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                await handleDocUpload(file, 'servis_sonrasi', 'Servis Sonrası');
                                e.target.value = '';
                              }
                            }}
                          />
                          <label htmlFor="service-after-photo" className="btn btn-secondary btn-small" style={{ cursor: 'pointer' }}>
                            📷 Seç
                          </label>
                          {jobDocuments.some(d => d.type === 'servis_sonrasi') && (
                            <span className="badge badge-success" style={{ marginLeft: 8 }}>✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Butonlar */}
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button
                    className="btn btn-warning"
                    type="button"
                    style={{ flex: 1 }}
                    disabled={actionLoading || !inputs.serviceWorkNote}
                    onClick={() => {
                      const visits = [...(job.service?.visits || [])];
                      const currentIdx = visits.findIndex(v => v.status === 'in_progress');
                      if (currentIdx >= 0) {
                        visits[currentIdx] = {
                          ...visits[currentIdx],
                          workNote: inputs.serviceWorkNote,
                          materials: inputs.serviceMaterials,
                          extraCost: Number(inputs.serviceExtraCost || 0),
                          status: 'completed',
                          completedAt: new Date().toISOString()
                        };
                      }
                      act(
                        () =>
                          updateJobStatus(job.id, {
                            status: 'SERVIS_DEVAM_EDIYOR',
                            service: { ...job.service, visits }
                          }),
                        { transition: 'SERVIS_DEVAM_EDIYOR' }
                      );
                    }}
                  >
                    🔄 Servis Devam Ediyor (Yeni Randevu)
                  </button>
                  <button
                    className="btn btn-success"
                    type="button"
                    style={{ flex: 1 }}
                    disabled={actionLoading || !inputs.serviceWorkNote}
                    onClick={() => {
                      const visits = [...(job.service?.visits || [])];
                      const currentIdx = visits.findIndex(v => v.status === 'in_progress');
                      if (currentIdx >= 0) {
                        visits[currentIdx] = {
                          ...visits[currentIdx],
                          workNote: inputs.serviceWorkNote,
                          materials: inputs.serviceMaterials,
                          extraCost: Number(inputs.serviceExtraCost || 0),
                          status: 'completed',
                          completedAt: new Date().toISOString()
                        };
                      }
                      // Toplam ekstra maliyet hesapla
                      const totalExtraCost = visits.reduce((sum, v) => sum + (v.extraCost || 0), 0);
                      act(
                        () =>
                          updateJobStatus(job.id, {
                            status: 'SERVIS_ODEME_BEKLIYOR',
                            service: { 
                              ...job.service, 
                              visits,
                              totalExtraCost,
                              totalCost: (job.service?.fixedFee || 0) + totalExtraCost
                            }
                          }),
                        { transition: 'SERVIS_ODEME_BEKLIYOR' }
                      );
                    }}
                  >
                    💰 Ödemeye Geç
                  </button>
                </div>
                {!inputs.serviceWorkNote && (
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    ⚠️ Devam etmek için "Yapılan İşlem Detayı" alanını doldurun.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {isServiceJob && isStageSelected('service_payment') && (() => {
        // Hesaplamalar
        const fixedFee = job.service?.fixedFee || 0;
        const totalExtraCost = job.service?.totalExtraCost || 0;
        const totalCost = job.service?.totalCost || (fixedFee + totalExtraCost);
        
        const paymentCash = Number(inputs.servicePaymentCash || 0);
        const paymentCard = Number(inputs.servicePaymentCard || 0);
        const paymentTransfer = Number(inputs.servicePaymentTransfer || 0);
        const discount = Number(inputs.serviceDiscount || 0);
        const totalReceived = paymentCash + paymentCard + paymentTransfer + discount;
        const balance = totalCost - totalReceived;
        
        return (
          <div className="card">
            {/* Salt Okunur Banner */}
            {isReadOnly && (
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderBottom: '1px solid var(--color-border)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#475569'
              }}>
                <span style={{ fontSize: 18 }}>📂</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Arşiv Görünümü</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>Bu aşama tamamlandı. Sadece görüntüleme modundasınız.</div>
                </div>
              </div>
            )}
            <div className="card-header">
              <h3 className="card-title">💰 Servis Ödeme</h3>
            </div>
            <div className="card-body grid grid-1" style={{ gap: 16 }}>
              
              {/* Ziyaret Özeti */}
              {job.service?.visits?.length > 0 && (
                <div className="card subtle-card">
                  <div className="card-header" style={{ padding: '12px 16px' }}>
                    <h4 className="card-title" style={{ fontSize: 14 }}>📋 Ziyaret Özeti ({job.service.visits.length} ziyaret)</h4>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {job.service.visits.filter(v => v.status === 'completed').map((visit) => (
                      <div key={visit.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <strong>#{visit.id}</strong> - {new Date(visit.appointmentDate).toLocaleDateString('tr-TR')}
                            <div className="text-muted" style={{ fontSize: 12 }}>{visit.workNote}</div>
                          </div>
                          {visit.extraCost > 0 && (
                            <div style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                              +{formatNumber(visit.extraCost)} ₺
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Tutar Özeti */}
              <div className="card" style={{ background: 'var(--color-bg-secondary)', border: '2px solid var(--color-border)' }}>
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Sabit Servis Ücreti</span>
                      <span style={{ fontWeight: 600 }}>{formatNumber(fixedFee)} ₺</span>
                    </div>
                    {totalExtraCost > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Ekstra Malzeme Toplamı</span>
                        <span style={{ fontWeight: 600 }}>{formatNumber(totalExtraCost)} ₺</span>
                      </div>
                    )}
                    <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: 8, marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 18, fontWeight: 700 }}>TOPLAM</span>
                        <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>{formatNumber(totalCost)} ₺</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Ödeme Kutucukları */}
              <div className="card subtle-card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>💳 Ödeme Bilgileri</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="grid grid-3" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">💵 Nakit</label>
                      <CurrencyInput
                        placeholder="0"
                        value={inputs.servicePaymentCash || ''}
                        onChange={(val) => setInputs((p) => ({ ...p, servicePaymentCash: val }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">💳 Kredi Kartı</label>
                      <CurrencyInput
                        placeholder="0"
                        value={inputs.servicePaymentCard || ''}
                        onChange={(val) => setInputs((p) => ({ ...p, servicePaymentCard: val }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">🏦 Havale/EFT</label>
                      <CurrencyInput
                        placeholder="0"
                        value={inputs.servicePaymentTransfer || ''}
                        onChange={(val) => setInputs((p) => ({ ...p, servicePaymentTransfer: val }))}
                      />
                    </div>
                  </div>
                  
                  {/* Alınan Toplam */}
                  <div style={{ marginTop: 16, padding: 12, background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Alınan Toplam:</span>
                      <span style={{ fontWeight: 600, fontSize: 18 }}>{formatNumber(paymentCash + paymentCard + paymentTransfer)} ₺</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* İskonto */}
              <div className="card subtle-card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>🏷️ İskonto (İsteğe Bağlı)</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  {balance > 0 && discount === 0 && (
                    <div style={{ marginBottom: 12, padding: 10, background: 'var(--color-warning-bg)', borderRadius: 6, color: 'var(--color-warning-dark)' }}>
                      ⚠️ Toplam tutara {formatNumber(balance)} ₺ eksik. İskonto yapılacaksa aşağıya girin.
                    </div>
                  )}
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">İskonto Tutarı {balance > 0 && discount === 0 ? '*' : ''}</label>
                      <CurrencyInput
                        placeholder="0"
                        value={inputs.serviceDiscount || ''}
                        onChange={(val) => setInputs((p) => ({ ...p, serviceDiscount: val }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">İskonto Açıklaması {discount > 0 ? '*' : ''}</label>
                      <input
                        className="form-input"
                        placeholder="Örn: Sadık müşteri indirimi"
                        value={inputs.serviceDiscountNote || ''}
                        onChange={(e) => setInputs((p) => ({ ...p, serviceDiscountNote: e.target.value }))}
                      />
                    </div>
                  </div>
                  {discount > 0 && !inputs.serviceDiscountNote && (
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 8, color: 'var(--color-danger)' }}>
                      ⚠️ İskonto tutarı girildiyse açıklama zorunludur.
                    </div>
                  )}
                </div>
              </div>
              
              {/* Bakiye Durumu */}
              <div style={{ 
                padding: 16, 
                borderRadius: 12, 
                background: balance === 0 ? 'var(--color-success-bg)' : balance > 0 ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)',
                border: `2px solid ${balance === 0 ? 'var(--color-success)' : balance > 0 ? 'var(--color-warning)' : 'var(--color-danger)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>Bakiye:</span>
                  <span style={{ 
                    fontWeight: 700, 
                    fontSize: 20,
                    color: balance === 0 ? 'var(--color-success)' : balance > 0 ? 'var(--color-warning-dark)' : 'var(--color-danger)'
                  }}>
                    {balance === 0 ? '✓ 0 ₺ (Tamam)' : `${formatNumber(balance)} ₺`}
                  </span>
                </div>
              </div>
              
              {/* Butonlar */}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  className="btn btn-warning"
                  type="button"
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                  onClick={() =>
                    act(
                      () =>
                        updateJobStatus(job.id, {
                          status: 'SERVIS_DEVAM_EDIYOR',
                          service: {
                            ...job.service,
                            payments: {
                              cash: paymentCash,
                              card: paymentCard,
                              transfer: paymentTransfer,
                            },
                            discount: discount > 0 ? { amount: discount, note: inputs.serviceDiscountNote } : null,
                          },
                        }),
                      { transition: 'SERVIS_DEVAM_EDIYOR' }
                    )
                  }
                >
                  🔄 Servis Devam Ediyor
                </button>
                <button
                  className="btn btn-success"
                  type="button"
                  style={{ flex: 1 }}
                  disabled={actionLoading || balance !== 0 || (discount > 0 && !inputs.serviceDiscountNote)}
                  onClick={() =>
                    act(
                      () =>
                        updateJobStatus(job.id, {
                          status: 'SERVIS_KAPALI',
                          service: {
                            ...job.service,
                            payments: {
                              cash: paymentCash,
                              card: paymentCard,
                              transfer: paymentTransfer,
                            },
                            discount: discount > 0 ? { amount: discount, note: inputs.serviceDiscountNote } : null,
                            paymentStatus: 'paid',
                            completedAt: new Date().toISOString(),
                          },
                        }),
                      { transition: 'SERVIS_KAPALI' }
                    )
                  }
                >
                  ✓ Servisi Kapat
                </button>
              </div>
              
              {balance !== 0 && (
                <div className="text-muted" style={{ fontSize: 12, color: 'var(--color-danger)' }}>
                  ⚠️ Servisi kapatmak için bakiye 0 olmalı. Eksik: {formatNumber(balance)} ₺
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {isServiceJob && isStageSelected('service_done') && (() => {
        const payments = job.service?.payments || {};
        const totalPaid = (payments.cash || 0) + (payments.card || 0) + (payments.transfer || 0);
        const discount = job.service?.discount?.amount || 0;
        
        return (
          <div className="card" style={{ border: '2px solid var(--color-success)' }}>
            {/* Salt Okunur Banner */}
            {isReadOnly && (
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderBottom: '1px solid var(--color-border)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#475569'
              }}>
                <span style={{ fontSize: 18 }}>📂</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Arşiv Görünümü</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>Bu aşama tamamlandı. Sadece görüntüleme modundasınız.</div>
                </div>
              </div>
            )}
            <div className="card-header" style={{ background: 'var(--color-success)', color: 'white' }}>
              <h3 className="card-title" style={{ color: 'white' }}>✓ Servis Tamamlandı</h3>
              <span className="badge" style={{ background: 'white', color: 'var(--color-success)' }}>
                {job.service?.paymentStatus === 'paid' ? 'Ödendi' : 'Ödeme Bekliyor'}
              </span>
            </div>
            <div className="card-body" style={{ padding: 20 }}>
              {/* Özet Kartları */}
              <div className="grid grid-4" style={{ gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 16, background: 'var(--color-success-bg)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 4 }}>TOPLAM</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-success)' }}>
                    {formatNumber(job.service?.totalCost || 0)} ₺
                  </div>
                </div>
                <div style={{ padding: 16, background: 'var(--color-bg-secondary)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 4 }}>ZİYARET</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>
                    {job.service?.visits?.length || 1}
                  </div>
                </div>
                <div style={{ padding: 16, background: 'var(--color-bg-secondary)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 4 }}>ALINAN</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>
                    {formatNumber(totalPaid)} ₺
                  </div>
                </div>
                <div style={{ padding: 16, background: 'var(--color-bg-secondary)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 4 }}>TARİH</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {job.service?.completedAt ? new Date(job.service.completedAt).toLocaleDateString('tr-TR') : '-'}
                  </div>
                </div>
              </div>

              {/* Müşteri & İş Bilgisi */}
              <div className="card subtle-card" style={{ marginBottom: 16 }}>
                <div className="card-header" style={{ padding: '10px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 13 }}>👤 Müşteri Bilgisi</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{job.customerName}</div>
                      <div className="text-muted">{job.title}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="text-muted" style={{ fontSize: 11 }}>İş Kodu</div>
                      <div style={{ fontWeight: 600 }}>{job.id}</div>
                    </div>
                  </div>
                  {job.service?.note && (
                    <div style={{ marginTop: 12, padding: 10, background: 'var(--color-bg-secondary)', borderRadius: 6, fontSize: 13 }}>
                      <strong>Müşteri Talebi:</strong> {job.service.note}
                    </div>
                  )}
                </div>
              </div>

              {/* Ziyaret Geçmişi */}
              {job.service?.visits?.length > 0 && (
                <div className="card subtle-card" style={{ marginBottom: 16 }}>
                  <div className="card-header" style={{ padding: '10px 16px' }}>
                    <h4 className="card-title" style={{ fontSize: 13 }}>📅 Ziyaret Geçmişi</h4>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {job.service.visits.map((visit, idx) => (
                      <div key={visit.id} style={{ 
                        padding: '12px 16px', 
                        borderBottom: idx < job.service.visits.length - 1 ? '1px solid var(--color-border)' : 'none',
                        background: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <strong>#{visit.id}</strong>
                              <span className="badge badge-success" style={{ fontSize: 10 }}>✓</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                              📅 Randevu: {new Date(visit.appointmentDate).toLocaleDateString('tr-TR')} {visit.appointmentTime}
                            </div>
                            {visit.visitedAt && (
                              <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                                🚗 Gidiş: {new Date(visit.visitedAt).toLocaleString('tr-TR')}
                              </div>
                            )}
                          </div>
                          {visit.extraCost > 0 && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: 'var(--color-text-light)' }}>Ekstra</div>
                              <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>+{formatNumber(visit.extraCost)} ₺</div>
                            </div>
                          )}
                        </div>
                        {visit.workNote && (
                          <div style={{ marginTop: 8, fontSize: 13, padding: 8, background: 'var(--color-bg-secondary)', borderRadius: 4 }}>
                            🔧 {visit.workNote}
                          </div>
                        )}
                        {visit.materials && (
                          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-light)' }}>
                            🔩 {visit.materials}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ödeme Detayları */}
              <div className="card subtle-card" style={{ marginBottom: 16 }}>
                <div className="card-header" style={{ padding: '10px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 13 }}>💰 Ödeme Detayları</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Sabit Servis Ücreti</span>
                      <span>{formatNumber(job.service?.fixedFee || 0)} ₺</span>
                    </div>
                    {(job.service?.totalExtraCost || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Ekstra Malzeme</span>
                        <span>{formatNumber(job.service.totalExtraCost)} ₺</span>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>Toplam</span>
                      <span>{formatNumber(job.service?.totalCost || 0)} ₺</span>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 8, marginTop: 8 }}>
                      {payments.cash > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span>💵 Nakit</span>
                          <span>{formatNumber(payments.cash)} ₺</span>
                        </div>
                      )}
                      {payments.card > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span>💳 Kart</span>
                          <span>{formatNumber(payments.card)} ₺</span>
                        </div>
                      )}
                      {payments.transfer > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span>🏦 Havale</span>
                          <span>{formatNumber(payments.transfer)} ₺</span>
                        </div>
                      )}
                      {discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-warning-dark)' }}>
                          <span>🏷️ İskonto ({job.service?.discount?.note || ''})</span>
                          <span>-{formatNumber(discount)} ₺</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fotoğraflar */}
              {jobDocuments.filter(d => d.type === 'servis_oncesi' || d.type === 'servis_sonrasi').length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📷 Fotoğraflar</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {jobDocuments.filter(d => d.type === 'servis_oncesi' || d.type === 'servis_sonrasi').map(doc => (
                      <a 
                        key={doc.id} 
                        href={getDocumentDownloadUrl(doc.id)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          padding: '8px 16px', 
                          background: 'var(--color-primary-bg)', 
                          borderRadius: 8,
                          fontSize: 12,
                          textDecoration: 'none',
                          color: 'var(--color-primary)'
                        }}
                      >
                        📷 {doc.type === 'servis_oncesi' ? 'Öncesi' : 'Sonrası'}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {(status === 'KAPALI' || status === 'SERVIS_KAPALI') && (
        <div className="card subtle-card">
          <div className="metric-row">
            <span className="metric-label">Durum</span>
            <span className="metric-value">{status === 'SERVIS_KAPALI' ? 'SERVİS TAMAMLANDI' : 'KAPALI'}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Not</span>
            <span className="metric-value">Kilitli - değişiklik için yetkili gerekir</span>
          </div>
        </div>
      )}

      {logs.length > 0 ? (
        <div className="card subtle-card">
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <h3 className="card-title">İş Günlüğü</h3>
            <button className="btn btn-secondary btn-small" type="button" onClick={() => setShowLogs((v) => !v)}>
              {showLogs ? 'Gizle' : 'Göster'}
            </button>
          </div>
          {showLogs ? (
            <div className="timeline">
              {logs.map((log) => (
                <div key={log.id} className="timeline-item">
                  <div className="timeline-point" />
                  <div>
                    <div className="timeline-title">
                      {new Date(log.createdAt).toLocaleString('tr-TR')} · {log.action}
                    </div>
                    <div className="timeline-subtitle">{log.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {logsError ? <div className="error-text">{logsError}</div> : null}
        </div>
      ) : null}

      {actionLoading && (
        <div className="loader-overlay">
          <Loader text="İşlem yapılıyor..." />
        </div>
      )}
    </div>
  );
};

export default JobsList;

