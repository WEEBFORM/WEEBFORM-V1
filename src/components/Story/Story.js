import React from 'react'
import { StyleSheet, Text, View, SafeAreaView, ImageBackground, Image, FlatList} from "react-native";
import EachStory from './EachStory';
import { useNavigation } from '@react-navigation/native';


const Story = () => {
  const navigation = useNavigation();
  const storyData = [
    {
      name: 'Adaugo',
      pictures: require('../../assets/story2.png'), 
      viewed: true,
    }, 
    {
      name: 'Mmezierim',
      pictures: require('../../assets/story3.png'), 
      viewed: false,
    },
    {
      name: 'Daniel',
      pictures: require('../../assets/story4.png'), 
      viewed: true,
    },
    {
      name: 'Julie',
      pictures: require('../../assets/story5.png'), 
      viewed: false,
    },
    {
      name: 'Shezzy',
      pictures: require('../../assets/story6.png'), 
      viewed: true,
    },
    {
      name: 'Emma',
      pictures: require('../../assets/story7.png'), 
      viewed: false,
    },
  ]

  const openStory = (index) => {
    navigation.navigate("StoryViewer", { storyData, currentIndex: index });
  };


  return (
    <View style={styles.layout}>
      {/* <View style={styles.newStory}>
        <Image source={require('../../assets/story1.png')}/>
        <Text style={styles.text}>
          Your Story 
        </Text>
        </View> */}
        <FlatList
          horizontal
          style={{gap: 20}}
          data={storyData}
          renderItem={({item, index})=>(
              <EachStory
              name={item.name}
              viewed={item.viewed}
              pictures={item.pictures}
              onPress={() => openStory(index)}
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