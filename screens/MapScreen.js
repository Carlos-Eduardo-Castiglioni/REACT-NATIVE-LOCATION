import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

const MapScreen = () => {
  const [location, setLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState([]);
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    const getLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permissão de localização negada');
        setLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setLoading(false);
    };

    getLocation();
  }, []);

  const searchLocation = async () => {
    if (!searchQuery) return;

    setLoading(true);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'geolocationapp/1.0 (contato@meuemail.com)',
          'Accept-Language': 'pt-BR',
        },
      });
      const data = await response.json();

      if (data.length > 0) {
        const place = data[0];
        setDestination({
          latitude: parseFloat(place.lat),
          longitude: parseFloat(place.lon),
        });

        fetchRoute({
          latitude: parseFloat(place.lat),
          longitude: parseFloat(place.lon),
        });
      }
    } catch (error) {
      console.error('Erro ao buscar local:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoute = async (destination) => {
    if (!origin || !destination) return;

    // Certifique-se de passar longitude,latitude na URL para a API OSRM
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const polyline = data.routes[0].geometry;
        const coordinates = decodePolyline(polyline);
        setRoute(coordinates);

        // Corrigir a ordem das coordenadas ao calcular a distância
        const dist = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
        setDistance(dist);
      }
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
    }
  };

  const decodePolyline = (encoded) => {
    let len = encoded.length;
    let index = 0;
    let lat = 0;
    let lng = 0;
    let coordinates = [];

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += deltaLat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += deltaLng;

      coordinates.push({
        latitude: (lat / 1E5),
        longitude: (lng / 1E5),
      });
    }

    return coordinates;
  };

  const handlePress = (e) => {
    const { coordinate } = e.nativeEvent;

    if (!origin) {
      setOrigin(coordinate);
    } else if (!destination) {
      setDestination(coordinate);
      fetchRoute(coordinate);
    }
  };

  const locateMe = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Permissão de localização negada');
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    const userLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    setOrigin(userLocation);

    if (destination) {
      fetchRoute(userLocation);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (value) => value * Math.PI / 180;

    const R = 6378; // Raio da Terra em quilômetros
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distância em quilômetros

    return distance.toFixed(2); // Retorna a distância com 2 casas decimais
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Buscar local..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#888"
        />
        <TouchableOpacity style={styles.button} onPress={searchLocation}>
          <Text style={styles.buttonText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.locateButton} onPress={locateMe}>
        <Text style={styles.buttonText}>Minha Localização</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
      ) : (
        location ? (
          <MapView
            style={styles.map}
            region={location}
            onPress={handlePress} // Seleção de pontos no mapa
          >
            {origin && <Marker coordinate={origin} title="Origem" />}
            {destination && <Marker coordinate={destination} title="Destino" />}
            {route.length > 0 && <Polyline coordinates={route} strokeColor="#3498db" strokeWidth={3} />}
          </MapView>
        ) : (
          <Text style={styles.errorMsg}>{errorMsg || "Localização não encontrada"}</Text>
        )
      )}

      {/* Exibir distância */}
      {distance && (
        <Text style={styles.distanceText}>
          Distância: {distance} km
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
    maxWidth: 400,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  locateButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  map: {
    width: '100%',
    height: '75%',
    borderRadius: 15,
    overflow: 'hidden',
  },
  loader: {
    marginTop: 20,
  },
  errorMsg: {
    color: '#e74c3c',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  distanceText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#333',
  }
});

export default MapScreen;
