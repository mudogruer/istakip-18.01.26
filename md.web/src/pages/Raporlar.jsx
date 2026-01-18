import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { getReports } from '../services/dataService';

const Raporlar = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getReports();
        setRows(payload);
      } catch (err) {
        setError(err.message || 'Raporlar alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader title="Raporlar" subtitle="Hazır ve devam eden raporlar" />

      {loading ? (
        <div className="card subtle-card">Raporlar yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Raporlar alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <DataTable
          columns={[
            { label: 'Rapor', accessor: 'title' },
            { label: 'Periyot', accessor: 'period' },
            { label: 'Durum', accessor: 'status' },
            { label: 'Sahip', accessor: 'owner' },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
};

export default Raporlar;

