import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { getJobs } from '../services/dataService';

const IslerUretimPlani = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getJobs();
        setJobs(payload);
      } catch (err) {
        setError(err.message || 'Üretim planı alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader title="Üretim Planı" subtitle="Termin ve duruma göre üretim işleri" />

      {loading ? (
        <div className="card subtle-card">Üretim planı yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Üretim planı alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <DataTable
          columns={[
            { label: 'İş', accessor: 'name' },
            { label: 'Müşteri', accessor: 'customer' },
            { label: 'Durum', accessor: 'status' },
            { label: 'Termin', accessor: 'dueDate' },
            { label: 'Sorumlu', accessor: 'owner' },
          ]}
          rows={jobs}
        />
      )}
    </div>
  );
};

export default IslerUretimPlani;

