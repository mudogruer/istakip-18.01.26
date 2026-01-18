import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { getReservations } from '../services/dataService';

const IslerMontajSevkiyat = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getReservations();
        setRows(payload);
      } catch (err) {
        setError(err.message || 'Montaj/sevkiyat verisi alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader title="Montaj / Sevkiyat" subtitle="İşlere ayrılmış ürünlerin sevkiyat planı" />

      {loading ? (
        <div className="card subtle-card">Sevkiyat planı yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Sevkiyat verisi alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <DataTable
          columns={[
            { label: 'İş Kodu', accessor: 'job' },
            { label: 'Kalem', accessor: 'item' },
            { label: 'Miktar', accessor: 'qty' },
            { label: 'Termin', accessor: 'dueDate' },
            { label: 'Durum', accessor: 'status' },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
};

export default IslerMontajSevkiyat;

