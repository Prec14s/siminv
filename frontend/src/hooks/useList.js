import { useCallback, useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../api/client";

/** Mengambil data berpaginasi dari API dengan filter. */
export default function useList(url, initialFilters = {}, { perPage = 10 } = {}) {
  const [filters, setFiltersState] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError("");
    try {
      const params = { page, per_page: perPage };
      Object.entries(filters).forEach(([k, v]) => { if (v !== "" && v != null) params[k] = v; });
      const res = await api.get(url, { params });
      if (id !== reqId.current) return;
      setData(res.data.data);
      setMeta(res.data.meta || {});
    } catch (e) {
      if (id === reqId.current) setError(errorMessage(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [url, page, perPage, filters]);

  useEffect(() => {
    const t = setTimeout(load, filters.search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (key, value) => { setPage(1); setFiltersState((f) => ({ ...f, [key]: value })); };

  return { data, meta, loading, error, page, setPage, filters, setFilter, reload: load };
}
