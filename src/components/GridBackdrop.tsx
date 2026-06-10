import React, { useEffect, useState } from 'react';
import { useColorModeValue } from './ui/color-mode';
import { Box, Image } from '@chakra-ui/react';
import { settingsService } from '../services/settings';
import { isAbsolutePath } from '../utils/path';

/**
 * Shared background layer (corner mascot watermark or full background fill) used by the
 * file grid, the root client list, and the client-folder card view so they share the same
 * backdrop. Self-contained: loads its own settings and reacts to `settings-updated`.
 * Render it as the first child of a `position="relative"` container; place real content above
 * with a higher zIndex.
 */
export const GridBackdrop: React.FC = () => {
  const [enableBackgrounds, setEnableBackgrounds] = useState(true);
  const [backgroundType, setBackgroundType] = useState<'watermark' | 'backgroundFill'>('watermark');
  const [watermarkUrl, setWatermarkUrl] = useState('');
  const [fillUrl, setFillUrl] = useState('');
  const bgFillOpacity = useColorModeValue(0.05, 0.1);

  useEffect(() => {
    let cancelled = false;
    const loadImageUrl = async (imagePath: string): Promise<string> => {
      if (!imagePath) return '';
      if (window.electronAPI?.readImageAsDataUrl) {
        try {
          const result = await window.electronAPI.readImageAsDataUrl(imagePath);
          if (result.success && result.dataUrl) return result.dataUrl;
        } catch { /* fall through */ }
      }
      if ((window.electronAPI as any)?.convertFilePathToHttpUrl) {
        try {
          const httpResult = await (window.electronAPI as any).convertFilePathToHttpUrl(imagePath);
          if (httpResult.success && httpResult.url) return httpResult.url;
        } catch { /* fall through */ }
      }
      return `file://${imagePath.replace(/\\/g, '/')}`;
    };

    const load = async () => {
      try {
        const settings = await settingsService.getSettings();
        const enabled = settings.enableBackgrounds !== false;
        const bgType = settings.backgroundType || 'watermark';
        const watermarkPath = settings.fileGridBackgroundPath || '';
        let fillPath = settings.backgroundFillPath || '';
        if (fillPath && !isAbsolutePath(fillPath) && (window.electronAPI as any)?.resolveBackgroundPath) {
          try {
            const r = await (window.electronAPI as any).resolveBackgroundPath(fillPath);
            if (r.success && r.path) fillPath = r.path;
          } catch { /* ignore */ }
        }
        const [w, f] = await Promise.all([loadImageUrl(watermarkPath), loadImageUrl(fillPath)]);
        if (cancelled) return;
        setEnableBackgrounds(enabled);
        setBackgroundType(bgType);
        setWatermarkUrl(w);
        setFillUrl(f);
      } catch {
        /* ignore — backdrop is decorative */
      }
    };

    load();
    const handler = () => load();
    window.addEventListener('settings-updated', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('settings-updated', handler);
    };
  }, []);

  if (!enableBackgrounds) return null;

  return (
    <>
      {backgroundType === 'backgroundFill' && fillUrl && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={0}
          pointerEvents="none"
          style={{
            backgroundImage: `url(${fillUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: bgFillOpacity,
          }}
        />
      )}
      {backgroundType === 'watermark' && watermarkUrl && (
        <Box
          position="absolute"
          bottom="150px"
          right={0}
          zIndex={0}
          pointerEvents="none"
          maxW="320px"
          maxH="320px"
        >
          <Image
            src={watermarkUrl}
            alt=""
            maxW="100%"
            maxH="100%"
            objectFit="contain"
            opacity={1}
            userSelect="none"
            draggable={false}
            style={{ WebkitUserSelect: 'none', userSelect: 'none', display: 'block' }}
          />
        </Box>
      )}
    </>
  );
};
