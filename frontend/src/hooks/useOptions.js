import { useEffect, useState } from "react";
import api from "../api/client";

/** Opsi master data aktif untuk dropdown. */
export default function useOptions(kinds) {
  const [opts, setOpts] = useState({});
  const key = kinds.join(",");
  useEffect(() => {
    let alive = true;
    const list = key.split(",");
    Promise.all(list.map((k) => api.get(`/master/${k}`, { params: { all: 1, active_only: 1 } })))
      .then((res) => {
        if (!alive) return;
        const out = {};
        list.forEach((k, i) => { out[k] = res[i].data.data; });
        setOpts(out);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [key]);
  return opts;
}
