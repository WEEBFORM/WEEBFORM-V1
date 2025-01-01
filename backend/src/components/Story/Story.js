import React from 'react'
import { StyleSheet, Text, View, SafeAreaView, ImageBackground, Image, FlatList} from "react-native";
import EachStory from './EachStory';


const Story = () => {
  const storyData = [
    {
      name: 'Adaugo',
      pictures: '', 
      viewed: true,
    }, 
    {
      name: 'Mmezierim',
      pictures: '', 
      viewed: false,
    },
    {
      name: 'Daniel',
      pictures: '', 
      viewed: true,
    },
    {
      name: 'Julie',
      pictures: '', 
      viewed: false,
    },
    {
      name: 'Shezzy',
      pictures: '', 
      viewed: true,
    },
  ]
  return (
    <View style={styles.layout}>
      <View style={styles.newStory}>
        <Image source={require('../../assets/story1.png')}/>
        <Text style={styles.text}>
          Your Story 
        </Text>
        </View>
        <FlatList
          horizontal
          style={{gap: 20}}
          data={storyData}
          renderItem={({item})=>(
                <EachStory
              name={item.name}
              viewed={item.viewed}
            />
          )}
          showsHorizontalScrollIndicator={false}
        />
    </View>
  )
}

const styles = StyleSheet.create({
  layout:{
    flexDirection:'row',
    gap: 20,
    paddingHorizontal: 10,
    marginBottom: 10,
  }
})

export default Story