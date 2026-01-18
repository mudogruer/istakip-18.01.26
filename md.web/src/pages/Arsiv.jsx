import { useEffect, useState, useMemo } from 'react';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import { getDocuments, getJobs, deleteDocument, getDocumentDownloadUrl } from '../services/dataService';

const DOCUMENT_TYPES = {
  olcu: { label: 'Ölçü Taslağı', icon: '📏', color: '#3b82f6' },
  teknik: { label: 'Teknik Çizim', icon: '📐', color: '#8b5cf6' },
  sozlesme: { label: 'Sözleşme', icon: '📋', color: '#10b981' },
  teklif: { label: 'Teklif', icon: '💰', color: '#f59e0b' },
  diger: { label: 'Diğer', icon: '📄', color: '#6b7280' },
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

const formatFileSize = (bytes) => {
  if (!bytes) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const Arsiv = () => {
  const [documents, setDocuments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [docsPayload, jobsPayload] = await Promise.all([
          getDocuments(),
          getJobs(),
        ]);
        setDocuments(docsPayload);
        setJobs(jobsPayload);
      } catch (err) {
        setError(err.message || 'Arşiv alınamadı');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Get job info by ID
  const getJobInfo = (jobId) => {
    const job = jobs.find((j) => j.id === jobId);
    return job ? { title: job.title, customer: job.customerName } : { title: '-', customer: '-' };
  };

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const jobInfo = getJobInfo(doc.jobId);
        const matchesSearch =
          doc.originalName?.toLowerCase().includes(searchLower) ||
          doc.filename?.toLowerCase().includes(searchLower) ||
          doc.description?.toLowerCase().includes(searchLower) ||
          jobInfo.title?.toLowerCase().includes(searchLower) ||
          jobInfo.customer?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (typeFilter !== 'all' && doc.type !== typeFilter) return false;

      // Job filter
      if (jobFilter !== 'all' && doc.jobId !== jobFilter) return false;

      // Date filter
      if (dateFrom) {
        const docDate = new Date(doc.uploadedAt);
        const fromDate = new Date(dateFrom);
        if (docDate < fromDate) return false;
      }
      if (dateTo) {
        const docDate = new Date(doc.uploadedAt);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59);
        if (docDate > toDate) return false;
      }

      return true;
    });
  }, [documents, search, typeFilter, jobFilter, dateFrom, dateTo, jobs]);

  // Stats
  const stats = useMemo(() => {
    const byType = {};
    Object.keys(DOCUMENT_TYPES).forEach((t) => (byType[t] = 0));
    documents.forEach((d) => {
      if (byType[d.type] !== undefined) byType[d.type]++;
      else byType.diger++;
    });
    return {
      total: documents.length,
      byType,
    };
  }, [documents]);

  const handleDelete = async (docId) => {
    if (!window.confirm('Bu dökümanı silmek istediğinize emin misiniz?')) return;
    try {
      setDeleting(true);
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setPreviewDoc(null);
    } catch (err) {
      alert(err.message || 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setJobFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const isImage = (mimeType) => mimeType?.startsWith('image/');
  const isPdf = (mimeType) => mimeType === 'application/pdf';

  return (
    <div className="container">
      <PageHeader
        title="Dijital Arşiv"
        subtitle="Tüm iş dökümanlarını görüntüleyin ve yönetin"
      />

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="grid grid-4" style={{ gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label">🔍 Ara</label>
              <input
                className="form-input"
                type="text"
                placeholder="Dosya adı, iş, müşteri..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">📂 Kategori</label>
              <select
                className="form-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">Tümü</option>
                {Object.entries(DOCUMENT_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.icon} {val.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">📋 İş</label>
              <select
                className="form-select"
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
              >
                <option value="all">Tüm İşler</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title} - {j.customerName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">📅 Tarih Aralığı</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  className="form-input"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          </div>
          {(search || typeFilter !== 'all' || jobFilter !== 'all' || dateFrom || dateTo) && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted">
                {filteredDocs.length} / {documents.length} döküman gösteriliyor
              </span>
              <button className="btn btn-secondary btn-small" onClick={clearFilters}>
                ✕ Filtreleri Temizle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Documents List */}
      {loading ? (
        <Loader text="Dökümanlar yükleniyor..." />
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Hata</div>
          <div className="error-message">{error}</div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <h3 style={{ margin: '0 0 8px 0' }}>Döküman Bulunamadı</h3>
            <p className="text-muted">Arama kriterlerinize uygun döküman yok.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Dosya Adı</th>
                  <th>Kategori</th>
                  <th>İş</th>
                  <th>Müşteri</th>
                  <th>Boyut</th>
                  <th>Yüklenme Tarihi</th>
                  <th style={{ width: 120 }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const docType = DOCUMENT_TYPES[doc.type] || DOCUMENT_TYPES.diger;
                  const jobInfo = getJobInfo(doc.jobId);
                  return (
                    <tr key={doc.id} style={{ cursor: 'pointer' }} onClick={() => setPreviewDoc(doc)}>
                      <td>
                        <span style={{ fontSize: 20 }}>{docType.icon}</span>
                      </td>
                      <td>
                        <strong>{doc.originalName}</strong>
                        {doc.description && (
                          <div className="text-muted" style={{ fontSize: 12 }}>{doc.description}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge" style={{ background: `${docType.color}20`, color: docType.color }}>
                          {docType.label}
                        </span>
                      </td>
                      <td>{jobInfo.title}</td>
                      <td>{jobInfo.customer}</td>
                      <td className="text-muted">{formatFileSize(doc.size)}</td>
                      <td>{formatDate(doc.uploadedAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <a
                            href={getDocumentDownloadUrl(doc.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-small"
                            title="İndir"
                          >
                            ⬇
                          </a>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => setPreviewDoc(doc)}
                            title="Önizle"
                          >
                            👁
                          </button>
                          <button
                            className="btn btn-danger btn-small"
                            onClick={() => handleDelete(doc.id)}
                            title="Sil"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Archive Summary Footer */}
      {!loading && documents.length > 0 && (
        <div style={{ 
          marginTop: 16, 
          padding: '12px 16px', 
          background: 'var(--bg-secondary)', 
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div className="text-muted" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span><strong>{stats.total}</strong> toplam döküman</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            {Object.entries(DOCUMENT_TYPES).map(([key, val]) => 
              stats.byType[key] > 0 && (
                <span key={key} style={{ color: val.color }}>
                  {val.icon} {stats.byType[key]} {val.label}
                </span>
              )
            )}
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            {filteredDocs.length !== documents.length && (
              <span>{filteredDocs.length} / {documents.length} gösteriliyor</span>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        open={Boolean(previewDoc)}
        title={previewDoc?.originalName || 'Döküman Önizleme'}
        onClose={() => setPreviewDoc(null)}
        size="xlarge"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setPreviewDoc(null)}>
              Kapat
            </button>
            {previewDoc && (
              <>
                <a
                  href={getDocumentDownloadUrl(previewDoc.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  ⬇ İndir
                </a>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(previewDoc.id)}
                  disabled={deleting}
                >
                  🗑 Sil
                </button>
              </>
            )}
          </>
        }
      >
        {previewDoc && (
          <div>
            {/* Document Info */}
            <div className="grid grid-4" style={{ gap: 16, marginBottom: 16 }}>
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>Kategori</div>
                <div style={{ fontWeight: 600 }}>
                  {DOCUMENT_TYPES[previewDoc.type]?.icon} {DOCUMENT_TYPES[previewDoc.type]?.label || 'Diğer'}
                </div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>İş</div>
                <div style={{ fontWeight: 600 }}>{getJobInfo(previewDoc.jobId).title}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>Müşteri</div>
                <div style={{ fontWeight: 600 }}>{getJobInfo(previewDoc.jobId).customer}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12 }}>Yüklenme Tarihi</div>
                <div style={{ fontWeight: 600 }}>{formatDate(previewDoc.uploadedAt)}</div>
              </div>
            </div>

            {previewDoc.description && (
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>Açıklama</div>
                <div>{previewDoc.description}</div>
              </div>
            )}

            {/* Preview Area */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', minHeight: 400 }}>
              {isImage(previewDoc.mimeType) ? (
                <img
                  src={getDocumentDownloadUrl(previewDoc.id)}
                  alt={previewDoc.originalName}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              ) : isPdf(previewDoc.mimeType) ? (
                <iframe
                  src={getDocumentDownloadUrl(previewDoc.id)}
                  title={previewDoc.originalName}
                  style={{ width: '100%', height: 600, border: 'none' }}
                />
              ) : (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>📄</div>
                  <h3 style={{ margin: '0 0 8px 0' }}>Önizleme Mevcut Değil</h3>
                  <p className="text-muted">Bu dosya türü için önizleme desteklenmiyor.</p>
                  <a
                    href={getDocumentDownloadUrl(previewDoc.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ marginTop: 16 }}
                  >
                    ⬇ Dosyayı İndir
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Arsiv;
