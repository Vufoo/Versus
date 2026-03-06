import React from 'react';

// TypeScript module-resolution shim:
// Metro resolves `MapPreview.native.tsx` / `MapPreview.web.tsx` at runtime,
// but TypeScript doesn't consider platform extensions by default.
type MapPreviewProps = {
  latitude: number;
  longitude: number;
};

export default function MapPreview(_props: MapPreviewProps) {
  return null;
}

