import React, { useState } from 'react'
import { StyleSheet, Text, View, SafeAreaView, ImageBackground, Image} from "react-native";
import Explore from '../pages/Explore';
import WhoToFollow from '../pages/WhoToFollow';
import NewPost from '../pages/NewPost';
import News from '../pages/Marketplace';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';



const Tab = createBottomTabNavigator();


const Nav = () => {
    const [explore, setExplore] = useState(true)
    const [newPost, setNewPost] = useState(false)
    function showExplore(){
        setExplore(true)
    }
    function showNewPost(){
        setNewPost(true)
    }
  return (
    <View style={styles.layout}>
        <Text style={styles.text}>
            Explore
        </Text>
        <Text style={styles.text}>New post</Text>
    </View>
    // <Tab.Navigator>
    // <Tab.Screen name='Explore' component={Explore}/>
    //   <Tab.Screen name="Who to follow" component={WhoToFollow} />
    //   <Tab.Screen name="New Post" component={NewPost} />
    //   <Tab.Screen name="News" component={News} />
    // </Tab.Navigator>
  )
}


const styles = StyleSheet.create({
    layout:{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        paddingHorizontal: 10,
        paddingVertical: 10,
        marginBottom: 10
    },
    text:{
        color: 'white',
        fontSize: 18
    }
})

export default Nav