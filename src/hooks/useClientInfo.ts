import { useState, useEffect, useCallback } from 'react';
import {
  findClientRow,
  getAddress,
  getClientLink,
  getClientName,
  getIrdNumber,
  getJobLink,
  resolveJobLinkFallback,
  yearsWithJobLinks,
  type ClientDbRow,
} from '../services/clientDatabaseCsv';
import { getClientRows } from '../services/clientDb';

export type ClientInfo = ClientDbRow;

export function useClientInfo(currentDirectory: string, rootDirectory: string) {
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const pathSegments = currentDirectory ? currentDirectory.split(/[\/\\]/).filter(segment => segment && segment !== '') : [];
  const rootSegments = rootDirectory ? rootDirectory.split(/[\/\\]/).filter(Boolean) : [];
  const rootIdx = pathSegments.findIndex(seg => seg.toLowerCase() === (rootSegments[rootSegments.length - 1] || '').toLowerCase());
  // New structure: Root/ClientName/subfolders — client is direct child of root
  const clientName = rootIdx !== -1 && pathSegments.length > rootIdx + 1 ? pathSegments[rootIdx + 1] : '';
  // Derive taxYear from path if a year-named segment exists after client
  const yearSegment = pathSegments.find((seg, i) => i > rootIdx + 1 && /^20\d{2}$/.test(seg));
  const taxYear = yearSegment || '';

  const loadClientInfo = useCallback(async () => {
    if (!clientName) {
      setClientInfo(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await getClientRows();
      if (!rows || rows.length === 0) {
        setLoading(false);
        return;
      }
      const match = findClientRow(rows, clientName);
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

  const getClientNameDisplay = () => getClientName(clientInfo);
  const getIRDNumber = () => getIrdNumber(clientInfo);
  const getAddressDisplay = () => getAddress(clientInfo);

  const openClientLink = () => {
    const link = getClientLink(clientInfo);
    if (link) window.open(link, '_blank');
  };

  const openJobLink = (year?: string) => {
    if (!clientInfo) return;
    if (year) {
      const link = getJobLink(clientInfo, year);
      if (link) window.open(link, '_blank');
      return;
    }
    const link = resolveJobLinkFallback(clientInfo, taxYear);
    if (link) window.open(link, '_blank');
  };

  const sep = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win') ? '\\' : '/';

  const clientFolderPath =
    clientInfo && rootIdx !== -1 && pathSegments.length > rootIdx + 1
      ? pathSegments.slice(0, rootIdx + 2).join(sep)
      : null;

  const jobYearsWithLinks = yearsWithJobLinks(clientInfo);

  return {
    clientInfo,
    loading,
    taxYear,
    clientName,
    getClientName: getClientNameDisplay,
    getIRDNumber,
    getAddress: getAddressDisplay,
    openClientLink,
    openJobLink,
    hasClientLink: !!getClientLink(clientInfo),
    jobYearsWithLinks,
    clientFolderPath,
  };
}
