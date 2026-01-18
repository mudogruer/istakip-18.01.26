import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import AutocompleteInput from '../components/AutocompleteInput';
import {
  getSettingsAll,
  getJobRolesConfig,
  createJobRoleConfig,
  updateJobRoleConfig,
  deleteJobRoleConfig,
  getGlassTypes,
  createGlassType,
  deleteGlassType,
  getSuppliersFromAPI,
} from '../services/dataService';

const TABS = [
  { id: 'general', label: 'Genel Ayarlar', icon: '⚙️' },
  { id: 'jobRoles', label: 'İş Kolları', icon: '🏭' },
  { id: 'glassTypes', label: 'Cam Tipleri', icon: '🪟' },
];

const PRODUCTION_TYPES = [
  { value: 'internal', label: 'İç Üretim', color: 'var(--success)' },
  { value: 'external', label: 'Dış Sipariş', color: 'var(--warning)' },
];

const Ayarlar = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Data
  const [settings, setSettings] = useState({});
  const [jobRoles, setJobRoles] = useState([]);
  const [glassTypes, setGlassTypes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  // Modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    productionType: 'internal',
    requiresGlass: false,
    defaultGlassSupplier: null,
    defaultSupplier: null,
    estimatedDays: 5,
    active: true,
  });
  
  const [showGlassModal, setShowGlassModal] = useState(false);
  const [glassForm, setGlassForm] = useState({ name: '', code: '' });
  
  const [actionLoading, setActionLoading] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [settingsData, rolesData, glassData, suppliersData] = await Promise.all([
        getSettingsAll(),
        getJobRolesConfig(),
        getGlassTypes(),
        getSuppliersFromAPI(),
      ]);
      
      setSettings(settingsData);
      setJobRoles(rolesData || []);
      setGlassTypes(glassData || []);
      setSuppliers(suppliersData || []);
    } catch (err) {
      setError(err.message || 'Ayarlar alınamadı');
    } finally {
      setLoading(false);
    }
  };

  // Job Role CRUD
  const openRoleModal = (role = null) => {
    if (role) {
      setEditingRole(role);
      setRoleForm({
        name: role.name || '',
        description: role.description || '',
        productionType: role.productionType || 'internal',
        requiresGlass: role.requiresGlass || false,
        defaultGlassSupplier: role.defaultGlassSupplier || null,
        defaultSupplier: role.defaultSupplier || null,
        estimatedDays: role.estimatedDays || 5,
        active: role.active !== false,
      });
    } else {
      setEditingRole(null);
      setRoleForm({
        name: '',
        description: '',
        productionType: 'internal',
        requiresGlass: false,
        defaultGlassSupplier: null,
        defaultSupplier: null,
        estimatedDays: 5,
        active: true,
      });
    }
    setShowRoleModal(true);
  };

  const saveRole = async () => {
    if (!roleForm.name.trim()) {
      alert('İş kolu adı gerekli');
      return;
    }
    
    try {
      setActionLoading(true);
      if (editingRole) {
        await updateJobRoleConfig(editingRole.id, roleForm);
      } else {
        await createJobRoleConfig(roleForm);
      }
      await loadData();
      setShowRoleModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteRole = async (roleId) => {
    if (!confirm('Bu iş kolunu pasif yapmak istediğinize emin misiniz?')) return;
    
    try {
      setActionLoading(true);
      await deleteJobRoleConfig(roleId);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Glass Type CRUD
  const saveGlassType = async () => {
    if (!glassForm.name.trim() || !glassForm.code.trim()) {
      alert('Cam adı ve kodu gerekli');
      return;
    }
    
    try {
      setActionLoading(true);
      await createGlassType(glassForm);
      await loadData();
      setShowGlassModal(false);
      setGlassForm({ name: '', code: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const removeGlassType = async (glassId) => {
    if (!confirm('Bu cam tipini silmek istediğinize emin misiniz?')) return;
    
    try {
      setActionLoading(true);
      await deleteGlassType(glassId);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Render
  if (loading) {
    return (
      <div>
        <PageHeader title="Ayarlar" subtitle="Sistem ve iş kolu yapılandırması" />
        <div className="card subtle-card">Ayarlar yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Ayarlar" subtitle="Sistem ve iş kolu yapılandırması" />
        <div className="card error-card">
          <div className="error-title">Ayarlar alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Ayarlar" subtitle="Sistem ve iş kolu yapılandırması" />

      {/* Tab Navigation */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ flex: 1 }}
            >
              <span style={{ marginRight: '0.5rem' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Genel Ayarlar</h3>
          </div>
          <div className="card-body">
            <div className="metric-list">
              {(settings.general || []).map((row) => (
                <div className="metric-row" key={row.id}>
                  <div>
                    <div className="metric-label">{row.label}</div>
                    <div className="page-subtitle">{row.description}</div>
                  </div>
                  <span className={`badge badge-${row.value ? 'success' : 'secondary'}`}>
                    {row.value ? 'Açık' : 'Kapalı'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Job Roles */}
      {activeTab === 'jobRoles' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title">İş Kolları Yapılandırması</h3>
              <p className="page-subtitle">Her iş kolunun üretim tipini ve bağımlılıklarını belirleyin</p>
            </div>
            <button className="btn btn-primary" onClick={() => openRoleModal()}>
              + Yeni İş Kolu
            </button>
          </div>
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>İş Kolu</th>
                  <th>Üretim Tipi</th>
                  <th>Cam Gerekli</th>
                  <th>Varsayılan Tedarikçi</th>
                  <th>Tahmini Süre</th>
                  <th>Durum</th>
                  <th style={{ width: '100px' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {jobRoles.map((role) => {
                  const prodType = PRODUCTION_TYPES.find((pt) => pt.value === role.productionType);
                  const supplier = suppliers.find((s) => s.id === (role.defaultSupplier || role.defaultGlassSupplier));
                  
                  return (
                    <tr key={role.id} style={{ opacity: role.active === false ? 0.5 : 1 }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{role.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{role.description}</div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: prodType?.color || 'var(--bg-tertiary)', color: '#fff' }}
                        >
                          {prodType?.label || role.productionType}
                        </span>
                      </td>
                      <td>
                        {role.requiresGlass ? (
                          <span className="badge badge-info">🪟 Evet</span>
                        ) : (
                          <span className="badge badge-secondary">Hayır</span>
                        )}
                      </td>
                      <td>
                        {supplier ? supplier.name : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>{role.estimatedDays} gün</td>
                      <td>
                        <span className={`badge badge-${role.active !== false ? 'success' : 'secondary'}`}>
                          {role.active !== false ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => openRoleModal(role)}
                            title="Düzenle"
                          >
                            ✏️
                          </button>
                          {role.active !== false && (
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => deleteRole(role.id)}
                              title="Pasif Yap"
                              style={{ color: 'var(--danger)' }}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {jobRoles.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Henüz iş kolu tanımlanmamış
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Glass Types */}
      {activeTab === 'glassTypes' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title">Cam Tipleri</h3>
              <p className="page-subtitle">Cam siparişlerinde kullanılacak cam tiplerini tanımlayın</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowGlassModal(true)}>
              + Yeni Cam Tipi
            </button>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {glassTypes.map((glass) => (
                <div
                  key={glass.id}
                  className="card"
                  style={{ margin: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                >
                  <div className="card-body" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>🪟 {glass.name}</div>
                        <div className="badge badge-secondary">{glass.code}</div>
                      </div>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => removeGlassType(glass.id)}
                        style={{ color: 'var(--danger)' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {glassTypes.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Henüz cam tipi tanımlanmamış
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Job Role Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={editingRole ? 'İş Kolu Düzenle' : 'Yeni İş Kolu'}
        size="medium"
      >
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">İş Kolu Adı *</label>
            <input
              type="text"
              className="form-input"
              value={roleForm.name}
              onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
              placeholder="Örn: PVC Doğrama"
            />
          </div>
          
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Açıklama</label>
            <input
              type="text"
              className="form-input"
              value={roleForm.description}
              onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              placeholder="Kısa açıklama"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Üretim Tipi *</label>
            <select
              className="form-select"
              value={roleForm.productionType}
              onChange={(e) => setRoleForm({ ...roleForm, productionType: e.target.value })}
            >
              {PRODUCTION_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Tahmini Üretim Süresi (gün)</label>
            <input
              type="number"
              className="form-input"
              value={roleForm.estimatedDays}
              onChange={(e) => setRoleForm({ ...roleForm, estimatedDays: parseInt(e.target.value) || 5 })}
              min={1}
            />
          </div>
          
          {roleForm.productionType === 'internal' && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={roleForm.requiresGlass}
                  onChange={(e) => setRoleForm({ ...roleForm, requiresGlass: e.target.checked })}
                />
                Cam bağımlılığı var (Dışarıdan cam siparişi gerekir)
              </label>
            </div>
          )}
          
          {roleForm.productionType === 'internal' && roleForm.requiresGlass && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Varsayılan Cam Tedarikçisi</label>
              <AutocompleteInput
                value={roleForm.defaultGlassSupplier || ''}
                onChange={(val) => setRoleForm({ ...roleForm, defaultGlassSupplier: val })}
                options={suppliers}
                displayKey="name"
                valueKey="id"
                placeholder="Tedarikçi ara..."
                onSelect={(supplier) => setRoleForm({ ...roleForm, defaultGlassSupplier: supplier?.id || null })}
              />
            </div>
          )}
          
          {roleForm.productionType === 'external' && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Varsayılan Tedarikçi</label>
              <AutocompleteInput
                value={roleForm.defaultSupplier || ''}
                onChange={(val) => setRoleForm({ ...roleForm, defaultSupplier: val })}
                options={suppliers}
                displayKey="name"
                valueKey="id"
                placeholder="Tedarikçi ara..."
                onSelect={(supplier) => setRoleForm({ ...roleForm, defaultSupplier: supplier?.id || null })}
              />
            </div>
          )}
          
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={roleForm.active}
                onChange={(e) => setRoleForm({ ...roleForm, active: e.target.checked })}
              />
              Aktif (İş oluştururken seçilebilir)
            </label>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button className="btn btn-ghost" onClick={() => setShowRoleModal(false)}>
            İptal
          </button>
          <button className="btn btn-primary" onClick={saveRole} disabled={actionLoading}>
            {actionLoading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </Modal>

      {/* Glass Type Modal */}
      <Modal
        isOpen={showGlassModal}
        onClose={() => setShowGlassModal(false)}
        title="Yeni Cam Tipi"
        size="small"
      >
        <div className="form-group">
          <label className="form-label">Cam Adı *</label>
          <input
            type="text"
            className="form-input"
            value={glassForm.name}
            onChange={(e) => setGlassForm({ ...glassForm, name: e.target.value })}
            placeholder="Örn: 4+16+4 Isıcam"
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Cam Kodu *</label>
          <input
            type="text"
            className="form-input"
            value={glassForm.code}
            onChange={(e) => setGlassForm({ ...glassForm, code: e.target.value })}
            placeholder="Örn: 4-16-4"
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button className="btn btn-ghost" onClick={() => setShowGlassModal(false)}>
            İptal
          </button>
          <button className="btn btn-primary" onClick={saveGlassType} disabled={actionLoading}>
            {actionLoading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Ayarlar;
