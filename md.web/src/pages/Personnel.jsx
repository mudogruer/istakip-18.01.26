import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import Loader from '../components/Loader';
import {
  getPersonnel,
  createPersonnel,
  updatePersonnel,
  softDeletePersonnel,
  togglePersonnelStatus,
  assignRoleToPersonnel,
  getRoles,
} from '../services/dataService';

const defaultForm = {
  ad: '',
  soyad: '',
  email: '',
  telefon: '',
  unvan: '',
  aktifMi: true,
  rolId: '',
};

const Personnel = () => {
  const [personnel, setPersonnel] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [aktifFilter, setAktifFilter] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [roleAssignTarget, setRoleAssignTarget] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [personnelData, rolesData] = await Promise.all([
          getPersonnel(),
          getRoles(true),
        ]);
        setPersonnel(personnelData);
        setRoles(rolesData);
      } catch (err) {
        setError(err.message || 'Personel verileri alınamadı');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = personnel.filter((p) => !p.deleted);
    if (aktifFilter !== null) {
      result = result.filter((p) => p.aktifMi === aktifFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          (p.ad || '').toLowerCase().includes(q) ||
          (p.soyad || '').toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (p.unvan || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [personnel, search, aktifFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (person) => {
    setEditing(person);
    setForm({
      ad: person.ad || '',
      soyad: person.soyad || '',
      email: person.email || '',
      telefon: person.telefon || '',
      unvan: person.unvan || '',
      aktifMi: person.aktifMi !== false,
      rolId: person.rolId || '',
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errors = {};
    if (!form.ad.trim()) errors.ad = 'Ad gerekli';
    if (!form.soyad.trim()) errors.soyad = 'Soyad gerekli';
    if (!form.email.trim()) errors.email = 'E-posta gerekli';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Geçerli bir e-posta adresi girin';
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
        const updated = await updatePersonnel(editing.id, form);
        setPersonnel((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setEditing(null);
      } else {
        const newPerson = await createPersonnel(form);
        setPersonnel((prev) => [newPerson, ...prev]);
      }
      setForm(defaultForm);
      setFormOpen(false);
    } catch (err) {
      setError(err.message || 'Kayıt başarısız');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (person, newStatus) => {
    try {
      const updated = await togglePersonnelStatus(person.id, newStatus);
      setPersonnel((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(err.message || 'Durum güncelleme başarısız');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDeletePersonnel(deleteTarget.id);
      setPersonnel((prev) =>
        prev.map((p) => (p.id === deleteTarget.id ? { ...p, deleted: true, aktifMi: false } : p))
      );
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'Silme işlemi başarısız');
    }
  };

  const handleAssignRole = async () => {
    if (!roleAssignTarget || !form.rolId) return;
    try {
      await assignRoleToPersonnel(roleAssignTarget.id, form.rolId);
      const updated = await getPersonnel();
      setPersonnel(updated);
      setRoleAssignTarget(null);
      setForm({ ...form, rolId: '' });
      setFormOpen(false);
    } catch (err) {
      setError(err.message || 'Rol atama başarısız');
    }
  };

  const getRoleName = (rolId) => {
    const role = roles.find((r) => r.id === rolId);
    return role ? role.ad : 'Rol yok';
  };

  const columns = useMemo(
    () => [
      {
        accessor: 'ad',
        label: 'Ad Soyad',
        render: (_, row) => (
          <div>
            <div className="font-medium">{`${row.ad} ${row.soyad}`}</div>
            {row.unvan && <div className="text-sm text-muted">{row.unvan}</div>}
          </div>
        ),
      },
      { accessor: 'email', label: 'E-posta' },
      { accessor: 'telefon', label: 'Telefon' },
      {
        accessor: 'rolId',
        label: 'Rol',
        render: (rolId) => <span className="badge badge-secondary">{getRoleName(rolId)}</span>,
      },
      {
        accessor: 'aktifMi',
        label: 'Durum',
        render: (aktifMi) => (
          <span className={`badge ${aktifMi ? 'badge-success' : 'badge-secondary'}`}>
            {aktifMi ? 'Aktif' : 'Pasif'}
          </span>
        ),
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
                openEdit(row);
              }}
            >
              Düzenle
            </button>
            <button
              className={`btn btn-sm ${row.aktifMi ? 'btn-warning' : 'btn-success'}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleStatus(row, !row.aktifMi);
              }}
            >
              {row.aktifMi ? 'Pasif Yap' : 'Aktif Yap'}
            </button>
            <button
              className="btn btn-sm btn-danger"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row);
              }}
            >
              Sil
            </button>
          </div>
        ),
      },
    ],
    [roles]
  );

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Personel Yönetimi"
        subtitle="Personel bilgilerini görüntüleyin ve yönetin"
        actions={
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            + Yeni Personel
          </button>
        }
      />

      {error && (
        <div className="card error-card">
          <div className="error-title">Hata</div>
          <div className="error-message">{error}</div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="filters">
            <input
              type="text"
              className="input"
              placeholder="Ara (ad, soyad, e-posta, ünvan)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="select"
              value={aktifFilter === null ? 'all' : aktifFilter ? 'aktif' : 'pasif'}
              onChange={(e) => {
                const val = e.target.value;
                setAktifFilter(val === 'all' ? null : val === 'aktif');
              }}
            >
              <option value="all">Tümü</option>
              <option value="aktif">Aktif</option>
              <option value="pasif">Pasif</option>
            </select>
          </div>
        </div>
        <DataTable columns={columns} rows={filtered} />
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setForm(defaultForm);
          setFormErrors({});
        }}
        title={editing ? '✏️ Personel Düzenle' : '✨ Yeni Personel'}
      >
        <form onSubmit={saveForm}>
          {/* Ad */}
          <div className="form-group">
            <label className="form-label">
              👤 Ad <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              className={`form-input ${formErrors.ad ? 'input-error' : ''}`}
              value={form.ad}
              onChange={(e) => setForm({ ...form, ad: e.target.value })}
              placeholder="Örn: Ahmet"
            />
            {formErrors.ad && (
              <div className="form-error" style={{ marginTop: 6, fontSize: 13, color: 'var(--color-danger)' }}>
                ⚠️ {formErrors.ad}
              </div>
            )}
          </div>

          {/* Soyad */}
          <div className="form-group">
            <label className="form-label">
              👤 Soyad <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="text"
              className={`form-input ${formErrors.soyad ? 'input-error' : ''}`}
              value={form.soyad}
              onChange={(e) => setForm({ ...form, soyad: e.target.value })}
              placeholder="Örn: Yılmaz"
            />
            {formErrors.soyad && (
              <div className="form-error" style={{ marginTop: 6, fontSize: 13, color: 'var(--color-danger)' }}>
                ⚠️ {formErrors.soyad}
              </div>
            )}
          </div>

          {/* E-posta */}
          <div className="form-group">
            <label className="form-label">
              📧 E-posta <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              type="email"
              className={`form-input ${formErrors.email ? 'input-error' : ''}`}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ornek@email.com"
            />
            {formErrors.email && (
              <div className="form-error" style={{ marginTop: 6, fontSize: 13, color: 'var(--color-danger)' }}>
                ⚠️ {formErrors.email}
              </div>
            )}
          </div>

          {/* Telefon ve Ünvan - İki Kolon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">📞 Telefon</label>
              <input
                type="text"
                className="form-input"
                value={form.telefon}
                onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                placeholder="+90 555 123 4567"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">💼 Ünvan</label>
              <input
                type="text"
                className="form-input"
                value={form.unvan}
                onChange={(e) => setForm({ ...form, unvan: e.target.value })}
                placeholder="Örn: Proje Müdürü"
              />
            </div>
          </div>

          {/* Rol ve Aktif - İki Kolon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">🔐 Rol</label>
              <select
                className="form-select"
                value={form.rolId}
                onChange={(e) => setForm({ ...form, rolId: e.target.value })}
              >
                <option value="">Rol seçin...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.ad}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.aktifMi}
                  onChange={(e) => setForm({ ...form, aktifMi: e.target.checked })}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                ✅ Aktif
              </label>
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

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="🗑️ Personel Sil"
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
              {deleteTarget && `${deleteTarget.ad} ${deleteTarget.soyad}`}
            </strong>
            {' '}personelini silmek istediğinize emin misiniz?
          </p>
          <p style={{ 
            fontSize: 13, 
            textAlign: 'center', 
            color: 'var(--color-text-light)',
            marginBottom: 0
          }}>
            Bu işlem geri alınamaz ve personel listeden kaldırılacaktır.
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

export default Personnel;
