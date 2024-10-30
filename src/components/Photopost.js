import React from 'react'
import { useState } from 'react';
import { StyleSheet, Text, View, Image, FlatList, SafeAreaView, ImageBackground} from "react-native";
import MorePost from './MorePost';
import { all } from 'axios';
import { Buffer } from 'buffer';
const ExploreData =[
    {
        id: '1',
        name: 'Shedrach',
        username: 'Shezzy',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 33,
        photo: true,
        liked: true
    },
    {
        id: '2',
        name: 'Bill gates',
        username: 'Shezzy',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 0,
        photo: false,
        liked: false
    },
    {
        id: '3',
        name: 'Shedrach',
        username: 'Shezzy',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 240,
        photo: true,
        liked: true
    },
    {
        id: '4',
        name: 'Shedrach',
        username: 'Shezzy',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 0,
        photo: false,
        liked: false
    },
    {
        id: '5',
        name: 'Bill gates',
        username: 'Shezzy',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 100,
        photo: true,
        liked: true
    },
    {
        id: '6',
        name: 'Shedrach',
        username: 'Shezzy',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 0,
        photo: false,
        liked: false
    },
]
const NewPostData =[
    {
        id: '1',
        name: 'Yaga',
        username: 'Shezzy',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 33,
        photo: true,
        liked: true
    },
    {
        id: '2',
        name: 'Bill',
        username: 'yoto',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 0,
        photo: false,
        liked: false
    },
    {
        id: '3',
        name: 'Shedrach',
        username: 'Shezzy',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 240,
        photo: true,
        liked: true
    },
    {
        id: '4',
        name: 'Shedrach',
        username: 'Shezzy',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 0,
        photo: false,
        liked: false
    },
    {
        id: '5',
        name: 'Bill gates',
        username: 'Shezzy',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 100,
        photo: true,
        liked: true
    },
    {
        id: '6',
        name: 'Shedrach',
        username: 'Shezzy',
        following: true,
        text: 'Catch me if you can',
        number_of_likes: 0,
        photo: false,
        liked: false
    },
]

const Photopost = ({allpost, newpost, categorypost}) => {
    const [liked, setLiked] = useState(false)
    const [more, setMore] = useState(false)
    const [explore, setExplore] = useState(true)
    const [newPost, setNewPost] = useState(false)
    function showExplore(){
        setExplore(true)
        setNewPost(false)
    }
    function showNewPost(){
        setNewPost(true)
        setExplore(false)
    }
    function likePost(){
        setLiked(!liked)
        console.log('liked')
    }
    function showmore(){
        setMore(!more)
        console.log('show')
    }
    function convertBufferToUrl(imgData){
        const imageBuffer = Buffer.from(imgData)
        const base64Image = imageBuffer.toString('base64')
        const imageUrl = `data:image/png;base64,${base64Image}`
        // console.log(imageUrl)
        return imageUrl
    }
    function convertDate(date){
        try{
          console.log(date)
            const date = new Date(date);
            const hours = date.getUTCHours().toString().padStart(2, '0');
            const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        const day = date.getUTCDate().toString().padStart(2, '0');
        const month = date.toLocaleString('default', { month: 'long' }); // e.g., "January"
        const year = date.getUTCFullYear();
        // if(hours<24){
        //   return `${hours}:${minutes}`;
        // }else{
        console.log(`${hours}:${minutes} ${day} ${month} ${year}`)
          return `${hours}:${minutes} ${day} ${month} ${year}`
        // }
        }catch(e){
          console.log('errr', e)
        }
      }
  return (
    <View style={styles.container}>
      <View style={styles.layoutNav}>
        <Text style={{...styles.textNav, color: explore ? '#CF833F': 'white'}} onPress={showExplore} >
            Explore
        </Text>
        <Text style={{...styles.textNav, color: newPost ? '#CF833F': 'white'}} onPress={showNewPost} >New post</Text>
    </View>
        <FlatList
        contentContainerStyle={{flexGrow:1}}
            data={explore ? allpost: NewPostData}
            renderItem={({item})=>(
                <View style={styles.layout}>
    <Image source={require('../assets/postInd.png')} style={styles.ind} />
        <View style={styles.top}>
        <View style={styles.topLeft}>
            <View>
                <Image style={styles.pfp} source={require('../assets/pfp.png')} />
            </View>
            <View style={styles.topMiddle}>
                <View>
                    <Text style={styles.text}>{item.username}</Text>
                    <Text style={styles.text}>@Shezzy</Text>
                </View>
                <View><Text style={styles.follow}>Follow</Text></View>
            </View>
            </View>
            <View><Image source={require('../assets/more.png')} onTouchStart={showmore} /></View>
        </View>
        <View style={styles.middle}>
            <Text style={styles.maintext}>{item.description}</Text>
            <View>
            {/* {item.photo && <Image style={styles.photo} source={require('../assets/post1.png')} />} */}
            {item.image && <Image style={styles.photo} source={item.image=== null ? require('../assets/post1.png'): {uri: `data:image/png;base64,${base64Image}`}} />}
            </View>
            {/* <Text style={styles.date}>{convertDate(item.createdAt)}</Text> */}
        </View>
        <View style={styles.bottom}>
            <View style={styles.reactionCon} onTouchStart={likePost} ><Image source={liked ? require('../assets/liked.png'): require('../assets/like.png')}/><Text style={{...styles.text2, color: liked ? '#FF0808': 'white'}}>{item.number_of_likes>0 ? item.number_of_likes: 0}</Text></View>
            <View style={styles.reactionCon}><Image source={require('../assets/comment.png')} /><Text style={styles.text2}>300</Text></View>
            <View style={styles.reactionCon}><Image source={require('../assets/repost.png')} /><Text style={styles.text2}>300</Text></View>
            <View style={styles.reactionCon}><Image source={require('../assets/save.png')} /><Text style={styles.text2}></Text></View>
            <View style={styles.reactionCon}><Image source={require('../assets/share.png')} /><Text style={styles.text2}></Text></View>
        </View>
    </View>
            )}
            keyExtractor={(item)=> item.id}
        />
        {
            more && <MorePost/>
        }
    </View>
    
  )
}

const styles = StyleSheet.create({
    container:{
        flex: 1,
        // borderWidth: 3,
        borderColor: 'white',
    },
    layoutNav:{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        paddingHorizontal: 10,
        paddingVertical: 10,
        marginBottom: 10
    },
    textNav:{
        color: 'white',
        fontSize: 18
    },
    layout:{
        marginVertical: 0,
        position: 'relative',
        paddingHorizontal: 20,
        // borderWidth: 3,
        borderColor: 'white'
    },
    ind:{
        position: 'absolute',
        left: 0,
        top: 15
    },
    top:{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    topLeft:{
        flexDirection: 'row',
        gap: 10
    },
    topMiddle:{
        flexDirection: 'row',
        gap: 20
    },
    pfp:{
        width: 60,
        height: 60,
        borderRadius: 50
    },
    text:{
        color: 'white',
        fontSize: 16,
        lineHeight: 22
    },
    reactionCon:{
        flexDirection: 'color',
        alignItems: 'center',
        justifyContent: 'center'
    },
    text2:{
        color: 'white',
        fontSize: 12,
        lineHeight: 22,
    },
    follow:{
        color: '#cf833f',
        fontSize: 16,
        lineHeight: 22
    },
    maintext:{
        color: 'white',
        fontSize: 18,
        lineHeight: 22
    },
    date:{
        color: 'white',
        fontSize: 10,
    },
    middle:{
        paddingVertical: 5,
        flexDirection: 'column',
        gap: 20
        // paddingHorizontal: 20
    }, 
    photo:{
        width: '100%',
        borderWidth: 1,
        borderColor: 'white'
    },
    bottom:{
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15, 
        borderTopColor: '#141313',
        borderTopWidth: 1,
        marginBottom: 10
    }
})


export default Photopost