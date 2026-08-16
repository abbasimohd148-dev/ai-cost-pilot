import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// Fetches analytics data scoped to current workspace + date range.
export function useScopedData(path, { extraParams = {}, projectId = null } = {}) {
  const { currentWorkspaceId, range, customRange, rangeParams } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        workspace_id: currentWorkspaceId,
        ...rangeParams(),
        ...extraParams,
      };
      if (projectId) params.project_id = projectId;
      const res = await api.get(path, { params });
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspaceId, range, customRange, path, projectId, JSON.stringify(extraParams)]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
