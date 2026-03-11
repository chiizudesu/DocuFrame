import { useState, useEffect, useCallback } from 'react';

export interface ClientInfo {
  [key: string]: string | undefined;
}

export function useClientInfo(currentDirectory: string, rootDirectory: string) {
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const pathSegments = currentDirectory ? currentDirectory.split(/[\/\\]/).filter(segment => segment && segment !== '') : [];
  const rootSegments = rootDirectory ? rootDirectory.split(/[\/\\]/).filter(Boolean) : [];
  const rootIdx = pathSegments.findIndex(seg => seg.toLowerCase() === (rootSegments[rootSegments.length - 1] || '').toLowerCase());
  const taxYear = rootIdx !== -1 && pathSegments.length > rootIdx + 1 ? pathSegments[rootIdx + 1] : '';
  const clientName = rootIdx !== -1 && pathSegments.length > rootIdx + 2 ? pathSegments[rootIdx + 2] : '';

  const loadClientInfo = useCallback(async () => {
    if (!clientName) {
      setClientInfo(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const config = await window.electronAPI.getConfig();
      const csvPath = (config as any).clientbasePath;
      if (!csvPath) {
        setLoading(false);
        return;
      }
      const rows = await window.electronAPI.readCsv(csvPath);
      if (!rows || rows.length === 0) {
        setLoading(false);
        return;
      }
      const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
      const match = rows.find((row: any) => {
        const field = clientNameFields.find(f => row[f] !== undefined);
        if (!field) return false;
        return String(row[field]).toLowerCase().replace(/\s+/g, '') === clientName.toLowerCase().replace(/\s+/g, '');
      }) || rows.find((row: any) => {
        const field = clientNameFields.find(f => row[f] !== undefined);
        if (!field) return false;
        return String(row[field]).toLowerCase().includes(clientName.toLowerCase());
      });
      setClientInfo(match || null);
    } catch {
      setClientInfo(null);
    }
    setLoading(false);
  }, [clientName]);

  useEffect(() => {
    if (clientName) {
      loadClientInfo();
    } else {
      setClientInfo(null);
    }
  }, [clientName, loadClientInfo]);

  const getClientName = () => {
    if (!clientInfo) return null;
    return clientInfo['Client Name'] || clientInfo['ClientName'] || clientInfo['client name'] || clientInfo['client_name'] || null;
  };

  const getIRDNumber = () => {
    if (!clientInfo) return null;
    return clientInfo['IRD No.'] || clientInfo['IRD Number'] || clientInfo['ird number'] || clientInfo['ird_number'] || null;
  };

  const getAddress = () => {
    if (!clientInfo) return null;
    return clientInfo['Address'] || clientInfo['address'] || null;
  };

  const openClientLink = () => {
    if (clientInfo && (clientInfo['Client Link'] || clientInfo['ClientLink'])) {
      window.open(clientInfo['Client Link'] || clientInfo['ClientLink'], '_blank');
    }
  };

  const openJobLink = (year?: string) => {
    if (!clientInfo) return;
    if (year) {
      const link = clientInfo[`${year} Job Link`];
      if (link) window.open(link, '_blank');
    } else {
      if (taxYear && clientInfo[`${taxYear} Job Link`]) {
        window.open(clientInfo[`${taxYear} Job Link`], '_blank');
      } else if (clientInfo['2025 Job Link']) {
        window.open(clientInfo['2025 Job Link'], '_blank');
      } else if (clientInfo['2026 Job Link']) {
        window.open(clientInfo['2026 Job Link'], '_blank');
      }
    }
  };

  const sep = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win') ? '\\' : '/';

  // The path to the client folder itself (root/year/clientName)
  const clientFolderPath =
    clientInfo && rootIdx !== -1 && pathSegments.length > rootIdx + 2
      ? pathSegments.slice(0, rootIdx + 3).join(sep)
      : null;

  return {
    clientInfo,
    loading,
    taxYear,
    clientName,
    getClientName,
    getIRDNumber,
    getAddress,
    openClientLink,
    openJobLink,
    hasClientLink: !!(clientInfo && (clientInfo['Client Link'] || clientInfo['ClientLink'])),
    has2025JobLink: !!(clientInfo && clientInfo['2025 Job Link']),
    has2026JobLink: !!(clientInfo && clientInfo['2026 Job Link']),
    clientFolderPath,
  };
}
