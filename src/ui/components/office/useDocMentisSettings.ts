/**
 * useDocMentisSettings
 *
 * Single source of truth for all docMentis-related preferences stored in
 * localStorage. Exposes typed values and stable setters.
 */
import { useState, useCallback } from 'react';

export const LS_DM_CONSENT = 'dm_consent';       // 'accepted' | 'declined' | absent
export const LS_DM_LICENSE = 'dm_license_key';   // string | ''
export const LS_DM_DOCX   = 'dm_preview_docx';   // 'true' | 'false'
export const LS_DM_PPTX   = 'dm_preview_pptx';
export const LS_DM_XLSX   = 'dm_preview_xlsx';

export type ConsentState = 'accepted' | 'declined' | null;

export interface DocMentisSettings {
  consent:     ConsentState;
  licenseKey:  string;
  previewDocx: boolean;
  previewPptx: boolean;
  previewXlsx: boolean;
}

function readSettings(): DocMentisSettings {
  const raw = localStorage.getItem(LS_DM_CONSENT);
  return {
    consent:     (raw === 'accepted' || raw === 'declined') ? raw : null,
    licenseKey:  localStorage.getItem(LS_DM_LICENSE) ?? '',
    previewDocx: localStorage.getItem(LS_DM_DOCX) !== 'false',
    previewPptx: localStorage.getItem(LS_DM_PPTX) !== 'false',
    previewXlsx: localStorage.getItem(LS_DM_XLSX) !== 'false',
  };
}

export function useDocMentisSettings() {
  const [settings, setSettings] = useState<DocMentisSettings>(readSettings);

  const refresh = useCallback(() => setSettings(readSettings()), []);

  const setConsent = useCallback((v: ConsentState) => {
    if (v === null) localStorage.removeItem(LS_DM_CONSENT);
    else            localStorage.setItem(LS_DM_CONSENT, v);
    refresh();
  }, [refresh]);

  const setLicenseKey = useCallback((v: string) => {
    if (v.trim()) localStorage.setItem(LS_DM_LICENSE, v.trim());
    else          localStorage.removeItem(LS_DM_LICENSE);
    refresh();
  }, [refresh]);

  const setPreviewEnabled = useCallback((ext: 'docx' | 'pptx' | 'xlsx', enabled: boolean) => {
    const key = ext === 'docx' ? LS_DM_DOCX : ext === 'pptx' ? LS_DM_PPTX : LS_DM_XLSX;
    localStorage.setItem(key, String(enabled));
    refresh();
  }, [refresh]);

  return { settings, setConsent, setLicenseKey, setPreviewEnabled };
}
