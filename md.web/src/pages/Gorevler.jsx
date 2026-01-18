import { useEffect, useState, useMemo } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import StatCard from '../components/StatCard';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  softDeleteTask,
  assignTask,
  updateTaskStatus,
  getPersonnel,
  getTeams,
} from '../services/dataService';

const DURUM_LABELS = {
  todo: { label: 'Yapılacak', tone: 'secondary', icon: '📋' },
  in_progress: { label: 'Devam Ediyor', tone: 'primary', icon: '🔄' },
  blocked: { label: 'Bloke', tone: 'warning', icon: '🚫' },
  done: { label: 'Tamamlandı', tone: 'success', icon: '✅' },
};

const ONCELIK_LABELS = {
  low: { label: 'Düşük', tone: 'secondary' },
  med: { label: 'Orta', tone: 'info' },
  high: { label: 'Yüksek', tone: 'warning' },
};

const renderDurum = (durum) => {
  const info = DURUM_LABELS[durum] || { label: durum, tone: 'secondary', icon: '❓' };
  return (
    <span className={`badge badge-${info.tone}`}>
      {info.icon} {info.label}
    </span>
  );
};

const renderOncelik = (oncelik) => {
  const info = ONCELIK_LABELS[oncelik] || { label: oncelik, tone: 'secondary' };
  return <span className={`badge badge-${info.tone}`}>{info.label}</span>;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
};

const defaultForm = {
  baslik: '',
  aciklama: '',
  oncelik: 'med',
  durum: 'todo',
  baslangicTarihi: '',
  bitisTarihi: '',
};

const Gorevler = () => {
  const [tasks, setTasks] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [durumFilter, setDurumFilter] = useState('');
  const [oncelikFilter, setOncelikFilter] = useState('');

  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [detailTask, setDetailTask] = useState(null);

  // Assign form state
  const [assignForm, setAssignForm] = useState({
    assigneeType: 'personnel',
    assigneeId: '',
    note: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [tasksData, personnelData, teamsData] = await Promise.all([
          getTasks(),
          getPersonnel(true),
          getTeams(true),
        ]);
        setTasks(tasksData);
        setPersonnel(personnelData);
        setTeams(teamsData);
      } catch (err) {
        setError(err.message || 'Görevler alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // KPI Hesaplamaları
  const kpiStats = useMemo(() => {
    const total = tasks.filter((t) => !t.deleted).length;
    const todo = tasks.filter((t) => !t.deleted && t.durum === 'todo').length;
    const inProgress = tasks.filter((t) => !t.deleted && t.durum === 'in_progress').length;
    const blocked = tasks.filter((t) => !t.deleted && t.durum === 'blocked').length;
    const done = tasks.filter((t) => !t.deleted && t.durum === 'done').length;

    return { total, todo, inProgress, blocked, done };
  }, [tasks]);

  const getAssigneeName = (task) => {
    if (task.assigneeName) {
      return task.assigneeType === 'team' ? `👥 ${task.assigneeName}` : task.assigneeName;
    }
    return 'Atanmamış';
  };

  const filtered = useMemo(() => {
    let result = tasks.filter((t) => !t.deleted);
    if (durumFilter) {
      result = result.filter((t) => t.durum === durumFilter);
    }
    if (oncelikFilter) {
      result = result.filter((t) => t.oncelik === oncelikFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (t) =>
          (t.baslik || '').toLowerCase().includes(q) ||
          (t.aciklama || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, search, durumFilter, oncelikFilter]);

  // CRUD Handlers
  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (task) => {
    setEditing(task);
    setForm({
      baslik: task.baslik || '',
      aciklama: task.aciklama || '',
      oncelik: task.oncelik || 'med',
      durum: task.durum || 'todo',
      baslangicTarihi: task.baslangicTarihi || '',
      bitisTarihi: task.bitisTarihi || '',
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const openAssign = (task) => {
    setAssignTarget(task);
    setAssignForm({
      assigneeType: 'personnel',
      assigneeId: '',
      note: '',
    });
    setAssignModalOpen(true);
  };

  const openDetail = async (task) => {
    try {
      const fullTask = await getTask(task.id);
      setDetailTask(fullTask);
      setDetailModalOpen(true);
    } catch (err) {
      setError(err.message || 'Görev detayı alınamadı');
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.baslik.trim()) errors.baslik = 'Başlık gerekli';
    if (form.baslangicTarihi && form.bitisTarihi) {
      const start = new Date(form.baslangicTarihi);
      const end = new Date(form.bitisTarihi);
      if (end < start) {
        errors.bitisTarihi = 'Bitiş tarihi başlangıç tarihinden önce olamaz';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveForm = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      setError('');
      if (editing) {
        const updated = await updateTask(editing.id, form);
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setEditing(null);
      } else {
        const newTask = await createTask(form);
        setTasks((prev) => [newTask, ...prev]);
      }
      setForm(defaultForm);
      setFormOpen(false);
    } catch (err) {
      setError(err.message || 'Görev kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDeleteTask(deleteTarget.id);
      setTasks((prev) =>
        prev.map((t) => (t.id === deleteTarget.id ? { ...t, deleted: true } : t))
      );
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'Görev silinemedi');
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignTarget || !assignForm.assigneeId) {
      setError('Lütfen atama yapılacak kişi veya ekibi seçin');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await assignTask(assignTarget.id, assignForm);
      // Listeyi yenile
      const tasksData = await getTasks();
      setTasks(tasksData);
      setAssignModalOpen(false);
      setAssignTarget(null);
      setAssignForm({ assigneeType: 'personnel', assigneeId: '', note: '' });
    } catch (err) {
      setError(err.message || 'Atama yapılamadı');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      const updated = await updateTaskStatus(task.id, newStatus);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err.message || 'Durum güncellenemedi');
    }
  };

  const columns = useMemo(
    () => [
      {
        accessor: 'baslik',
        label: 'Görev',
        render: (baslik, row) => (
          <div>
            <div className="font-medium">{baslik}</div>
            {row.aciklama && (
              <div className="text-sm text-muted">{row.aciklama.substring(0, 50)}...</div>
            )}
          </div>
        ),
      },
      {
        accessor: 'oncelik',
        label: 'Öncelik',
        render: (oncelik) => renderOncelik(oncelik),
      },
      {
        accessor: 'durum',
        label: 'Durum',
        render: (durum) => renderDurum(durum),
      },
      {
        accessor: 'bitisTarihi',
        label: 'Termin',
        render: (bitisTarihi) => formatDate(bitisTarihi),
      },
      {
        accessor: 'assignee',
        label: 'Atanan',
        render: (_, row) => getAssigneeName(row),
      },
      {
        accessor: 'actions',
        label: 'İşlem',
        render: (_, row) => (
          <div className="action-buttons">
            <button
              className="btn btn-sm btn-secondary"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openDetail(row);
              }}
              title="Detay"
            >
              👁️
            </button>
            <button
              className="btn btn-sm btn-primary"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
              title="Düzenle"
            >
              ✏️
            </button>
            <button
              className="btn btn-sm btn-info"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openAssign(row);
              }}
              title="Ata"
            >
              👤
            </button>
            <button
              className="btn btn-sm btn-danger"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row);
              }}
              title="Sil"
            >
              🗑️
            </button>
          </div>
        ),
      },
    ],
    []
  );

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Görevler"
        subtitle="Ekip görevlerinizi durumlarına göre takip edin"
        actions={
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            + Yeni Görev
          </button>
        }
      />

      {error && (
        <div className="card error-card">
          <div className="error-title">Hata</div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* KPI Kartları */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard icon="📋" label="Toplam Görev" value={kpiStats.total} tone="primary" />
        <StatCard icon="📝" label="Yapılacak" value={kpiStats.todo} tone="secondary" />
        <StatCard icon="🔄" label="Devam Ediyor" value={kpiStats.inProgress} tone="primary" />
        <StatCard icon="🚫" label="Bloke" value={kpiStats.blocked} tone="warning" />
        <StatCard icon="✅" label="Tamamlandı" value={kpiStats.done} tone="success" />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filters">
            <input
              type="text"
              className="input"
              placeholder="Ara (başlık, açıklama)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="select"
              value={durumFilter}
              onChange={(e) => setDurumFilter(e.target.value)}
            >
              <option value="">Tüm Durumlar</option>
              <option value="todo">Yapılacak</option>
              <option value="in_progress">Devam Ediyor</option>
              <option value="blocked">Bloke</option>
              <option value="done">Tamamlandı</option>
            </select>
            <select
              className="select"
              value={oncelikFilter}
              onChange={(e) => setOncelikFilter(e.target.value)}
            >
              <option value="">Tüm Öncelikler</option>
              <option value="low">Düşük</option>
              <option value="med">Orta</option>
              <option value="high">Yüksek</option>
            </select>
          </div>
        </div>
        <DataTable columns={columns} rows={filtered} emptyMessage="Henüz görev bulunmamaktadır. Yeni görev oluşturmak için üstteki 'Yeni Görev' butonuna tıklayın." />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setForm(defaultForm);
          setFormErrors({});
        }}
        title={editing ? '✏️ Görev Düzenle' : '✨ Yeni Görev Oluştur'}
      >
        <form onSubmit={saveForm}>
          {/* Başlık */}
          <div className="form-group">
            <label className="form-label">
              📋 Başlık <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              className={`form-input ${formErrors.baslik ? 'input-error' : ''}`}
              value={form.baslik}
              onChange={(e) => setForm({ ...form, baslik: e.target.value })}
              placeholder="Örn: Atölye kesim listesi hazırlama"
            />
            {formErrors.baslik && (
              <div className="form-error" style={{ marginTop: 6, fontSize: 13, color: 'var(--color-danger)' }}>
                ⚠️ {formErrors.baslik}
              </div>
            )}
          </div>

          {/* Açıklama */}
          <div className="form-group">
            <label className="form-label">📝 Açıklama</label>
            <textarea
              className="form-textarea"
              rows="4"
              value={form.aciklama}
              onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
              placeholder="Görev detaylarını buraya yazabilirsiniz..."
              style={{ minHeight: 100 }}
            />
          </div>

          {/* Öncelik ve Durum - İki Kolon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">⚡ Öncelik</label>
              <select
                className="form-select"
                value={form.oncelik}
                onChange={(e) => setForm({ ...form, oncelik: e.target.value })}
              >
                <option value="low">🟢 Düşük</option>
                <option value="med">🟡 Orta</option>
                <option value="high">🔴 Yüksek</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">📊 Durum</label>
              <select
                className="form-select"
                value={form.durum}
                onChange={(e) => setForm({ ...form, durum: e.target.value })}
              >
                <option value="todo">📋 Yapılacak</option>
                <option value="in_progress">🔄 Devam Ediyor</option>
                <option value="blocked">🚫 Bloke</option>
                <option value="done">✅ Tamamlandı</option>
              </select>
            </div>
          </div>

          {/* Tarihler - İki Kolon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">📅 Başlangıç Tarihi</label>
              <input
                type="date"
                className="form-input"
                lang="tr"
                value={form.baslangicTarihi ? form.baslangicTarihi.split('T')[0] : ''}
                onChange={(e) => setForm({ ...form, baslangicTarihi: e.target.value ? `${e.target.value}T00:00:00` : '' })}
                style={{ fontSize: 16, padding: 12 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                🎯 Bitiş Tarihi
              </label>
              <input
                type="date"
                className={`form-input ${formErrors.bitisTarihi ? 'input-error' : ''}`}
                lang="tr"
                value={form.bitisTarihi ? form.bitisTarihi.split('T')[0] : ''}
                onChange={(e) => setForm({ ...form, bitisTarihi: e.target.value ? `${e.target.value}T00:00:00` : '' })}
                style={{ fontSize: 16, padding: 12 }}
              />
              {formErrors.bitisTarihi && (
                <div className="form-error" style={{ marginTop: 6, fontSize: 13, color: 'var(--color-danger)' }}>
                  ⚠️ {formErrors.bitisTarihi}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="modal-actions" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>
              ❌ İptal
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '⏳ Kaydediliyor...' : editing ? '💾 Güncelle' : '✨ Oluştur'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setAssignTarget(null);
          setAssignForm({ assigneeType: 'personnel', assigneeId: '', note: '' });
        }}
        title="👤 Görev Ata"
      >
        {assignTarget && (
          <form onSubmit={handleAssign}>
            {/* Görev Bilgisi */}
            <div className="form-group">
              <label className="form-label">📋 Görev</label>
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 14,
                  color: 'var(--color-text)',
                }}
              >
                {assignTarget.baslik}
              </div>
            </div>

            {/* Atama Tipi */}
            <div className="form-group">
              <label className="form-label">
                🎯 Atama Tipi <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                className="form-select"
                value={assignForm.assigneeType}
                onChange={(e) => setAssignForm({ ...assignForm, assigneeType: e.target.value, assigneeId: '' })}
              >
                <option value="personnel">👤 Personel</option>
                <option value="team">👥 Ekip</option>
              </select>
            </div>

            {/* Personel/Ekip Seçimi */}
            <div className="form-group">
              <label className="form-label">
                {assignForm.assigneeType === 'personnel' ? '👤 Personel' : '👥 Ekip'}{' '}
                <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                className="form-select"
                value={assignForm.assigneeId}
                onChange={(e) => setAssignForm({ ...assignForm, assigneeId: e.target.value })}
              >
                <option value="">Seçin...</option>
                {assignForm.assigneeType === 'personnel'
                  ? personnel
                      .filter((p) => p.aktifMi && !p.deleted)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.ad} {p.soyad} {p.email ? `(${p.email})` : ''}
                        </option>
                      ))
                  : teams
                      .filter((t) => t.aktifMi && !t.deleted)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.ad} {t.aciklama ? `- ${t.aciklama}` : ''}
                        </option>
                      ))}
              </select>
            </div>

            {/* Not */}
            <div className="form-group">
              <label className="form-label">📝 Not (Opsiyonel)</label>
              <textarea
                className="form-textarea"
                rows="3"
                value={assignForm.note}
                onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })}
                placeholder="Atama ile ilgili notlarınızı buraya yazabilirsiniz..."
                style={{ minHeight: 80 }}
              />
            </div>

            {/* Actions */}
            <div className="modal-actions" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAssignModalOpen(false)}
              >
                ❌ İptal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || !assignForm.assigneeId}>
                {submitting ? '⏳ Atanıyor...' : '✅ Ata'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setDetailTask(null);
        }}
        title="📋 Görev Detayı"
        size="large"
      >
        {detailTask && (
          <div>
            {/* Header */}
            <div style={{ marginBottom: 32, paddingBottom: 20, borderBottom: '2px solid var(--color-border)' }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: 'var(--color-text)' }}>
                {detailTask.baslik}
              </h2>
              {detailTask.aciklama && (
                <p style={{ fontSize: 15, color: 'var(--color-text-light)', lineHeight: 1.6, margin: 0 }}>
                  {detailTask.aciklama}
                </p>
              )}
            </div>

            {/* Özellikler - İki Kolon Grid */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text)' }}>
                📊 Görev Bilgileri
              </h3>
              <div className="grid grid-2" style={{ gap: 16 }}>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}>⚡ Öncelik</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{renderOncelik(detailTask.oncelik)}</div>
                </div>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}>📊 Durum</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{renderDurum(detailTask.durum)}</div>
                </div>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}>📅 Başlangıç</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{formatDate(detailTask.baslangicTarihi) || '-'}</div>
                </div>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}>🎯 Bitiş</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{formatDate(detailTask.bitisTarihi) || '-'}</div>
                </div>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}>🕒 Oluşturulma</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{formatDateTime(detailTask.createdAt)}</div>
                </div>
                <div style={{ 
                  padding: 16, 
                  background: 'var(--color-bg)', 
                  borderRadius: 8, 
                  border: '1px solid var(--color-border)' 
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 6 }}>✏️ Güncellenme</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{formatDateTime(detailTask.updatedAt)}</div>
                </div>
              </div>
            </div>

            {/* Mevcut Atamalar */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text)' }}>
                👥 Mevcut Atamalar
              </h3>
              {detailTask.currentAssignments && detailTask.currentAssignments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {detailTask.currentAssignments.map((assignment) => {
                    const personnelMap = personnel.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
                    const teamsMap = teams.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});
                    let assigneeName = 'Bilinmiyor';
                    if (assignment.assigneeType === 'personnel') {
                      const person = personnelMap[assignment.assigneeId];
                      if (person) assigneeName = `${person.ad} ${person.soyad}`;
                    } else if (assignment.assigneeType === 'team') {
                      const team = teamsMap[assignment.assigneeId];
                      if (team) assigneeName = `👥 ${team.ad}`;
                    }
                    
                    return (
                      <div 
                        key={assignment.id} 
                        style={{
                          padding: 16,
                          background: 'var(--color-bg)',
                          borderRadius: 8,
                          border: '1px solid var(--color-primary)',
                          borderLeftWidth: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 18 }}>
                            {assignment.assigneeType === 'personnel' ? '👤' : '👥'}
                          </span>
                          <strong style={{ fontSize: 15 }}>
                            {assignment.assigneeType === 'personnel' ? 'Personel' : 'Ekip'}
                          </strong>
                          <span style={{ fontSize: 15, fontWeight: 500 }}>{assigneeName}</span>
                        </div>
                        {assignment.note && (
                          <div style={{ 
                            marginTop: 8, 
                            padding: 8, 
                            background: 'var(--color-white)', 
                            borderRadius: 4,
                            fontSize: 13,
                            color: 'var(--color-text-light)'
                          }}>
                            📝 {assignment.note}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginTop: 8 }}>
                          🕒 {formatDateTime(assignment.createdAt)} tarihinde atandı
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ 
                  padding: 24, 
                  textAlign: 'center', 
                  background: 'var(--color-bg)', 
                  borderRadius: 8,
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-light)'
                }}>
                  📭 Henüz atama yapılmamış
                </div>
              )}
            </div>

            {/* Atama Geçmişi */}
            {detailTask.assignmentHistory && detailTask.assignmentHistory.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text)' }}>
                  📜 Atama Geçmişi
                </h3>
                <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {detailTask.assignmentHistory.map((assignment) => {
                    const personnelMap = personnel.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
                    const teamsMap = teams.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});
                    let assigneeName = 'Bilinmiyor';
                    if (assignment.assigneeType === 'personnel') {
                      const person = personnelMap[assignment.assigneeId];
                      if (person) assigneeName = `${person.ad} ${person.soyad}`;
                    } else if (assignment.assigneeType === 'team') {
                      const team = teamsMap[assignment.assigneeId];
                      if (team) assigneeName = `👥 ${team.ad}`;
                    }
                    
                    return (
                      <div
                        key={assignment.id}
                        style={{
                          padding: 12,
                          background: 'var(--color-bg)',
                          borderRadius: 6,
                          borderLeft: assignment.active ? '4px solid var(--color-primary)' : '4px solid var(--color-border)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{assignment.assigneeType === 'personnel' ? '👤' : '👥'}</span>
                            <strong style={{ fontSize: 14 }}>
                              {assignment.assigneeType === 'personnel' ? 'Personel' : 'Ekip'}
                            </strong>
                            <span style={{ fontSize: 14 }}>{assigneeName}</span>
                          </div>
                          {assignment.active && (
                            <span className="badge badge-success" style={{ fontSize: 11 }}>
                              ✅ Aktif
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: assignment.note ? 6 : 0 }}>
                          🕒 {formatDateTime(assignment.createdAt)}
                        </div>
                        {assignment.note && (
                          <div style={{ 
                            fontSize: 13, 
                            color: 'var(--color-text-light)', 
                            marginTop: 6,
                            paddingTop: 6,
                            borderTop: '1px solid var(--color-border)'
                          }}>
                            📝 {assignment.note}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div 
              className="modal-actions" 
              style={{ 
                marginTop: 32, 
                paddingTop: 24, 
                borderTop: '2px solid var(--color-border)',
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end'
              }}
            >
              {detailTask.durum !== 'done' && (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => {
                    const nextStatus =
                      detailTask.durum === 'todo'
                        ? 'in_progress'
                        : detailTask.durum === 'in_progress'
                        ? 'done'
                        : 'todo';
                    handleStatusChange(detailTask, nextStatus);
                    setDetailModalOpen(false);
                  }}
                >
                  {detailTask.durum === 'todo'
                    ? '▶️ Başlat'
                    : detailTask.durum === 'in_progress'
                    ? '✅ Tamamla'
                    : '🔄 Yeniden Aç'}
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setDetailModalOpen(false);
                  openEdit(detailTask);
                }}
              >
                ✏️ Düzenle
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDetailModalOpen(false)}
              >
                ❌ Kapat
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="🗑️ Görev Sil"
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: 24,
            fontSize: 48
          }}>
            ⚠️
          </div>
          <p style={{ 
            fontSize: 16, 
            textAlign: 'center', 
            marginBottom: 8,
            color: 'var(--color-text)',
            lineHeight: 1.6
          }}>
            <strong style={{ fontSize: 18, color: 'var(--color-danger)' }}>
              {deleteTarget && deleteTarget.baslik}
            </strong>
            {' '}görevini silmek istediğinize emin misiniz?
          </p>
          <p style={{ 
            fontSize: 13, 
            textAlign: 'center', 
            color: 'var(--color-text-light)',
            marginBottom: 0
          }}>
            Bu işlem geri alınamaz ve görev listeden kaldırılacaktır.
          </p>
        </div>
        <div 
          className="modal-actions" 
          style={{ 
            marginTop: 32, 
            paddingTop: 20, 
            borderTop: '1px solid var(--color-border)'
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
            ❌ İptal
          </button>
          <button type="button" className="btn btn-danger" onClick={handleDelete}>
            🗑️ Sil
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Gorevler;
