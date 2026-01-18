import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { getPlanningEvents } from '../services/dataService';

const Planlama = () => {
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
        setError(err.message || 'Planlama verisi alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader title="Planlama / Takvim" subtitle="Keşif, montaj ve teslim planlarınızı takip edin" />

      {loading ? (
        <div className="card subtle-card">Planlama yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Planlama alınamadı</div>
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

export default Planlama;

