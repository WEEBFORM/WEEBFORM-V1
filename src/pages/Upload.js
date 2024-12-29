import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import Canvas from "../components/ui/canvas";
import { Globalstyles } from "../Styles/globalstyles";
import GapComponent from "../components/gap-component";
import Container from "../components/ui/container";

const Upload = ({ navigation }) => {
  const [photos, setPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const selectIcon = require("../assets/select.png");
  const cameraIcon = require("../assets/camera.png");
  const textIcon = require("../assets/text.png");
  // Load images from the gallery
  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === "granted") {
        const assets = await MediaLibrary.getAssetsAsync({
          mediaType: "photo",
          first: 50,
        });
        const photoUris = await Promise.all(
          assets.assets.map(async (asset) => {
            const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
            return { id: asset.id, uri: assetInfo.localUri || assetInfo.uri };
          })
        );
        setPhotos(photoUris);
      }
    })();
  }, []);

  // Select/Deselect an image
  const toggleSelect = (uri) => {
    if (selectedPhotos.includes(uri)) {
      setSelectedPhotos(selectedPhotos.filter((item) => item !== uri));
    } else {
      setSelectedPhotos([...selectedPhotos, uri]);
    }
  };

  return (
    <SafeAreaView style={Globalstyles.Home}>
      <Canvas>
        <Container>
          {/* Header Section */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Story</Text>
          </View>

          {/* Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={{
                width: 109,
                height: 64,
                borderRadius:6,
                backgroundColor: '#101010',
                alignItems: 'center',
                justifyContent: 'space-evenly'
              }}
              onPress={() => ImagePicker.launchCameraAsync()}
            >
              <Image source={cameraIcon} style={{
                width: 20,
                height: 20,
              }} />

              <Text style={{
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: "400",

              }}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
               style={{
                width: 109,
                height: 64,
                borderRadius:6,
                backgroundColor: '#101010',
                alignItems: 'center',
                justifyContent: 'space-evenly'
              }}
              onPress={() => navigation.navigate("AddText")}
            >
               <Image source={textIcon} style={{
                width: 20,
                height: 20,
              }} />

              <Text style={{
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: "400",

              }}>Text</Text>
            </TouchableOpacity>
          </View>

          {/* Gallery */}
          <GapComponent height={46} />
          <View
            style={{
              width: "100%",
              justifyContent: "space-between",
              alignItems: "center",
              flexDirection: "row",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: "500",
              }}
            >
              Gallery
            </Text>

            <TouchableOpacity
              style={{
                flexDirection: "row",
                gap: 3,
                height: 29,
                width: 132,
                borderRadius: 3,
                backgroundColor: "#101010",
                alignItems: "center",
              }}
            >
              <Image source={selectIcon} style={{ height: 18, width: 18 }} />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 13,
                  fontWeight: "500",
                }}
              >
                Select Multiple{" "}
              </Text>
            </TouchableOpacity>
          </View>
          <GapComponent height={26} />
          <FlatList
            data={photos}
            keyExtractor={(item) => item.id}
            numColumns={3}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.imageWrapper}
                onPress={() => toggleSelect(item.uri)}
              >
                <Image source={{ uri: item.uri }} style={styles.image} />
                {selectedPhotos.includes(item.uri) && (
                  <View style={styles.selectedOverlay} />
                )}
              </TouchableOpacity>
            )}
          />
        </Container>
      </Canvas>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },
  closeButton: {
    color: "#fff",
    fontSize: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginVertical: 10,
  },
  button: {
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
  },
  imageWrapper: {
    flex: 1 / 3,
    margin: 2,
    position: "relative",
  },
  image: {
    width: "100%",
    height: 120,
    borderRadius: 8,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#00f",
  },
  selectButton: {
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 8,
    margin: 10,
  },
  selectButtonText: {
    color: "#fff",
    textAlign: "center",
  },
});

export default Upload;
