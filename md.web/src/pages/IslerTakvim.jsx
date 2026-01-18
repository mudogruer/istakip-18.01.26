import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { getPlanningEvents } from '../services/dataService';

const IslerTakvim = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getPlanningEvents();
        setEvents(payload);
      } catch (err) {
        setError(err.message || 'Takvim verisi alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader title="Keşif / Ölçü Takvimi" subtitle="İşlere ait keşif, montaj ve teslim planları" />

      {loading ? (
        <div className="card subtle-card">Takvim yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Takvim alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <DataTable
          columns={[
            { label: 'Başlık', accessor: 'title' },
            { label: 'Tarih', accessor: 'date' },
            { label: 'Tür', accessor: 'type' },
            { label: 'Sorumlu', accessor: 'owner' },
            { label: 'Lokasyon', accessor: 'location' },
          ]}
          rows={events}
        />
      )}
    </div>
  );
};

export default IslerTakvim;

