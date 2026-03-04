import React from 'react';
import { StyleSheet, Image, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface MapPreviewProps {
  latitude: number;
  longitude: number;
}

const versusPin = require('../../assets/versus_blue.png');

export default function MapPreview({ latitude, longitude }: MapPreviewProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      liteMode={Platform.OS === 'android'}
      pointerEvents="none"
    >
      <Marker coordinate={{ latitude, longitude }}>
        <Image source={versusPin} style={{ width: 24, height: 24, resizeMode: 'contain' }} />
      </Marker>
    </MapView>
  );
}
