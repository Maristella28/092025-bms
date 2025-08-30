import axios from '../utils/axiosConfig';
import { useEffect, useState } from 'react';

// Custom hook to fetch residents (admin view, with completed profiles)
export default function useResidents() {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResidents = async () => {
      try {
        const res = await axios.get('/admin/residents');
        setResidents(res.data.residents || []);
      } catch (err) {
        setError('Unauthorized');
        setResidents([]); // Ensure residents is always an array even on error
      }
      setLoading(false);
    };
    fetchResidents();
  }, []);

  return { residents, loading, error };
}
