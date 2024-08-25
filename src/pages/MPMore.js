import React from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ImageBackground,
  Image,
  FlatList,
  ScrollView,
} from "react-native";


const MPMore = () => {
    const marketplacedata = [
        {
            name: 'School bags',
            id: 1,
            image: '' 
          },
          {
            name: 'Itachi Keyholder',
            id: 2,
            image: '' 
          },
          {
            name: 'Shirt',
            id: 3,
            image: ''
          },
          {
            name: 'Vest',
            id: 4,
            image: ''
          },
          {
            name: 'Shirt',
            id: 5,
            image: ''
          },
          {
            name: 'Vest',
            id: 6,
            image: ''
          },
    ]
  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.top}>
        <Image source={require('./../assets/logo.png')} style={styles.image} />
      </View>
      <View style={styles.alldata}>
        <Text style={styles.text}>Available Stores</Text>
        <FlatList
          data={marketplacedata}
          renderItem={({item})=>(
          <View style={styles.eachmp}>
          <Image source={require('./../assets/mp3.png')} />
          <View>
          <View>
          <Text style={{color: 'white'}}>Olakaumacha.n.g</Text>
          <Text style={{color: 'white'}} >Owned by bill gates</Text>
          </View>
          <View>
            <View style={styles.ratings}><Image source={require('./../assets/Star3.png')} /><Image source={require('./../assets/Star3.png')} /><Image source={require('./../assets/Star3.png')} /><Image source={require('./../assets/Star5.png')} /><Image source={require('./../assets/Star5.png')} /></View>
            <Text style={{color: 'white'}}>20 visits in the last 8days</Text>
          </View>
          </View>
          </View>
          )}
          keyExtractor={item=> item.id}
        />
      </View>
      <Text>MPMore</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container:{
    backgroundColor: 'black',
    flex: 1, 
  },
  top:{
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 30,
    marginBottom: 15
  },
  image:{
    objectFit: 'contain',
    width: 80,
    height: 80,
    marginLeft: 10 
  },
  text:{
    color: 'white',
    fontSize: 25,
    marginLeft: 20
  },
  alldata:{
    flexDirection: 'column',
    gap: 16,
    marginBottom: 100
  },
  eachmp:{
    marginBottom: 20,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    padding: 10,
    borderColor: '#1A1A1A',
    borderWidth: 2
  },
  ratings:{
    flexDirection: 'row'
  }
})

export default MPMore;
