import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

const MapScreen = () => {
  const mapRef = useRef(null);
  const [region, setRegion] = useState({
    latitude: -23.5505,  // São Paulo como fallback
    longitude: -46.6333,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState([]);
  const [distance, setDistance] = useState(null);

  // 1. Obter localização inicial
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        
        // Verificar permissão
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permissão de localização negada');
          return;
        }

        // Obter localização atual
        const location = await Location.getCurrentPositionAsync({});
        const newRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        
        setRegion(newRegion);
        setOrigin({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

      } catch (error) {
        console.error('Erro ao obter localização:', error);
        setErrorMsg('Não foi possível obter a localização');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2. Ajustar visualização do mapa quando destino muda
  useEffect(() => {
    if (destination && origin && mapRef.current) {
      mapRef.current.fitToCoordinates([origin, destination], {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      });
    }
  }, [destination, origin]);

  // 3. Buscar localização pelo texto
  const searchLocation = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Aviso', 'Digite um local para buscar');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Usar Nominatim API
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        {
          headers: {
            'User-Agent': 'MyApp/1.0 (myemail@example.com)',
            'Accept-Language': 'pt-BR',
          },
        }
      );

      if (!response.ok) throw new Error('Erro na requisição');

      const data = await response.json();
      if (!data || data.length === 0) throw new Error('Local não encontrado');

      const newDestination = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };

      setDestination(newDestination);
      await fetchRoute(newDestination);

    } catch (error) {
      console.error('Erro na busca:', error);
      setErrorMsg(error.message);
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Calcular rota
  const fetchRoute = async (dest) => {
    if (!origin || !dest) return;

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson`
      );

      if (!response.ok) throw new Error('Erro ao calcular rota');

      const data = await response.json();
      if (!data.routes || data.routes.length === 0) throw new Error('Rota não disponível');

      // Decodificar rota
      const coordinates = data.routes[0].geometry.coordinates.map(coord => ({
        latitude: coord[1],
        longitude: coord[0],
      }));

      setRoute(coordinates);
      setDistance((data.routes[0].distance / 1000).toFixed(2) + ' km');

    } catch (error) {
      console.error('Erro na rota:', error);
      setErrorMsg(error.message);
    }
  };

  // 5. Função para localização atual
  const locateMe = async () => {
    try {
      setLoading(true);
      const location = await Location.getCurrentPositionAsync({});
      const newOrigin = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setOrigin(newOrigin);
      setRegion(prev => ({
        ...prev,
        latitude: newOrigin.latitude,
        longitude: newOrigin.longitude,
      }));

      if (destination) {
        await fetchRoute(destination);
      }

    } catch (error) {
      console.error('Erro ao obter localização:', error);
      setErrorMsg('Não foi possível atualizar a localização');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Barra de busca */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Digite um endereço"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
          onSubmitEditing={searchLocation}
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={searchLocation}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {/* Botão de localização */}
      <TouchableOpacity
        style={styles.locateButton}
        onPress={locateMe}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Minha Localização</Text>
      </TouchableOpacity>

      {/* Mapa */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onPress={(e) => {
          const newDestination = e.nativeEvent.coordinate;
          setDestination(newDestination);
          fetchRoute(newDestination);
        }}
      >
        {origin && (
          <Marker
            coordinate={origin}
            title="Sua Localização"
            pinColor={Platform.OS === 'android' ? '#3498db' : undefined}
          />
        )}
        {destination && (
          <Marker
            coordinate={destination}
            title="Destino"
            pinColor={Platform.OS === 'android' ? '#e74c3c' : undefined}
          />
        )}
        {route.length > 0 && (
          <Polyline
            coordinates={route}
            strokeColor="#3498db"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Loader */}
      {loading && (
        <ActivityIndicator
          size="large"
          color="#3498db"
          style={styles.loader}
        />
      )}

      {/* Distância */}
      {distance && (
        <View style={styles.distanceContainer}>
          <Text style={styles.distanceText}>Distância: {distance}</Text>
        </View>
      )}

      {/* Mensagem de erro */}
      {errorMsg && !loading && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
};

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1,
    marginTop: 20,
  },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: 10,
  },
  searchButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 10,
    marginLeft: 10,
  },
  locateButton: {
    position: 'absolute',
    top: 80,
    right: 20,
    backgroundColor: '#282828',
    borderRadius: 8,
    padding: 10,
    zIndex: 1,
    marginTop: 30,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  distanceContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  distanceText: {
    fontWeight: 'bold',
  },
  errorContainer: {
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
    backgroundColor: '#e74c3c',
    padding: 10,
    borderRadius: 10,
  },
  errorText: {
    color: 'white',
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
});

export default MapScreen;