import React, { useState } from 'react'
import { StyleSheet, Text, View, SafeAreaView, Image, TextInput, ImageBackground, FlatList, ScrollView, StatusBar } from "react-native";
import EachNews from '../components/EachNews';


const News = () => {
  const [selected, setSelected] = useState(false)
  const [filter, setFilter] = useState(false)
  function select(){
    setSelected(!selected)
  }
  function showFilter(){
    setFilter(!filter)
    console.log('first')
  }
  const merch = [
    {
      name: 'School bags',
      id: 1 
    },
    {
      name: 'Itachi Keyholder',
      id: 2 
    },
    {
      name: 'Shirt',
      id: 3
    },
    {
      name: 'Vest',
      id: 4
    },
  ]
  const genres = [
    {
      name: 'Comedy',
      id: 1 
    },
    {
      name: 'Adventure',
      id: 2 
    },
    {
      name: 'Action',
      id: 3
    },
    {
      name: 'Sports',
      id: 4
    },
    {
      name: 'Comedy',
      id: 5 
    },
    {
      name: 'Adventure',
      id: 6
    },
    {
      name: 'Action',
      id: 7
    },
    {
      name: 'Sports',
      id: 8
    },
  ]
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Image source={require('./../assets/logo.png')} style={styles.image} />
        <View style={styles.filterCon}><Text style={styles.filter} onPress={showFilter} >Filter by</Text></View>
      </View>
      <ScrollView>
      <View style={styles.allnews}>
      <View style={styles.newsCon}>
      {
        filter && <>
        <Text style={styles.header}>Top Genres</Text>
        <View style={styles.genreConLayout} >
        {
          genres.map(item=>{
            return <View style={styles.genreCon} key={item.id}>
        <Text style={styles.genre}>{item.name}</Text>
        </View>
          })
        }
        </View>
        </>
      }
      </View>
      </View>
      <View style={styles.allnews}>
      <Image source={require('../assets/postInd.png')} style={styles.ind} />
      <View style={styles.newsCon}>
        <Text style={styles.header}>Top News</Text>
        <EachNews/>
      </View>
      </View>
      <View style={styles.allnews}>
      <Image source={require('../assets/postInd.png')} style={styles.ind} />
      <View style={styles.newsCon}>
        <Text style={styles.header}>Latest</Text>
        <EachNews/>
      </View>
      </View>
      <View style={styles.allnews}>
      <Image source={require('../assets/postInd.png')} style={styles.ind} />
      <View style={styles.newsCon}>
        <Text style={styles.header}>Top Airing This Season</Text>
        <EachNews/>
      </View>
      </View>
      <View style={styles.allnews}>
      <Image source={require('../assets/postInd.png')} style={styles.ind} />
      <View style={styles.newsCon}>
        <Text style={styles.header}>Promotional Merchandise</Text>
        <FlatList
          horizontal
          data={merch}
          renderItem={({item})=>(
            <View style={styles.promo}>
          <View style={styles.eachpromo}>
          <ImageBackground source={require('./../assets/bags.png')} style={styles.ProBck} >
          <Text style={styles.promotext}>School bags</Text> 
          </ImageBackground>
          </View>
        </View>
          )}
          keyExtractor={item=> item.id}
        />
      </View>
      </View>
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
  },
  image:{
    objectFit: 'contain',
    width: 80,
    height: 80
  },
  filterCon:{
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 30,
    backgroundColor: '#CF833F',
  },
  filter:{
    color: 'white',
   fontSize: 18
  },
  genreConLayout:{
    flexDirection: 'row',
    flexWrap: 1
  },
  genreCon:{
    borderWidth: 2,
    borderColor: '#171717',
    width: 100,
    padding: 10,
    borderRadius: 20,
    margin: 10,
  },
  genre:{
    color: '#999898',
    textAlign: 'center'
  },
  allnews:{
    backgroundColor: '#060606',
    marginTop: 20,
    position: 'relative'
  },
  header:{
    color: 'white',
    fontSize: 20,
  },
  ind:{
    position: 'absolute',
    left: 0,
    top: 0
},
newsCon:{
  marginLeft: 20,
  flexDirection: 'column',
  gap: 10 
},
eachpromo:{
  width: '25%',
  marginRight: 20
},
ProBck:{
  width: 100,
  height: 100,
  objectFit: 'contain'
},
promotext:{
  color: 'white',
  textAlign: 'center',
  margin: 'auto'
}
})

export default News