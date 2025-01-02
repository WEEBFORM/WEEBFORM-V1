import React from 'react'
import { StyleSheet, Text, View, SafeAreaView, ImageBackground, Image, FlatList, ScrollView} from "react-native";


const Marketplace = ({navigation}) => {
  const more = ()=>{
    navigation.navigate('More Marketplace')
}
  const pmore = ()=>{
    navigation.navigate('Popular Marketplace')
}
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
  ]
  return (
    <SafeAreaView style={styles.container}>
    <ScrollView>
         <View style={styles.top}>
        <Image source={require('./../assets/logo.png')} style={styles.image} />
        {/* <Image source={require('./../assets/logo.png')} style={styles.image} /> */}
      </View>
      <View style={styles.preview}>
        <Text style={styles.text}>Anime Merchandise</Text>
        <View>
          <ImageBackground style={styles.imgBack} source={require('./../assets/mp1.png')}>
              <View style={styles.visit}><Text style={{fontSize: '20', color: 'white'}}>Visit Store</Text><Image source={require('./../assets/genre.png')}/></View>
          </ImageBackground>
        </View>
      </View>
      <View style={styles.special}>
        <Text style={{color: 'white', fontSize: '25' }}>Special Collections</Text>
        <Text style={styles.seeAll} onPress={more} >SEE ALL</Text>
        <FlatList
          horizontal
          data={marketplacedata}
          renderItem={({item})=>(
            <View style={styles.othermp}>
          <View style={styles.eachmp}>
          <Image source={require('./../assets/mp2.png')} />
          </View>
        </View>
          )}
          keyExtractor={item=> item.id}
        />
      </View>
      <View style={styles.special}>
        <Text style={{color: 'white', fontSize: '25' }}>Popular Collections</Text>
        <Text style={styles.seeAll} onPress={pmore}>SEE ALL</Text>
        <FlatList
          horizontal
          data={marketplacedata}
          renderItem={({item})=>(
            <View style={styles.othermp}>
          <View style={styles.eachmp}>
          <Image source={require('./../assets/bags.png')} />
          </View>
        </View>
          )}
          keyExtractor={item=> item.id}
        />
      </View>
        <Text style={styles.text}>
          {/* Hellooo */}
        </Text>
        </ScrollView>
    </SafeAreaView>
  )
}

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
  preview:{
    flexDirection: 'column',
    gap: 20,
    // borderWidth: 2, 
    // borderColor: 'white',
  },
  imgBack:{
    height: 400,
    position: 'relative',
  },
  visit:{
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    position: 'absolute',
    bottom: 30,
    left: 20,
    color: '#CF833F',
    fontSize: 20,
    fontWeight: 700,
    backgroundColor: 'black',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderTopLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  special:{
    marginLeft: 20,
    marginTop: 25,
    position: 'relative'
  },
  othermp:{
    marginRight: 20,
    marginTop: 20,
  },
  seeAll:{
    color: '#CF833F',
    position: 'absolute',
    right: 15,
    top: 7.5
  }

})

export default Marketplace