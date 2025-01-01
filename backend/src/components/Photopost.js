import React from 'react'
import { useState } from 'react';
import { StyleSheet, Text, View, Image, FlatList, SafeAreaView, ImageBackground} from "react-native";
import MorePost from './MorePost';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const Photopost = ({allpost, newpost, categorypost}) => {
    const [likes, setLikes] = useState(false)
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
    // function likePost(){
    //     setLiked(!liked)
    //     console.log('liked')
    // }
    async function toggleLikePost(postId) {
        const Token = await SecureStore.getItemAsync("Token");
        console.log('Tokennn',Token)
        setLikes(prevLikes => ({
            ...prevLikes,
            [postId]: !prevLikes[postId] // Toggle like status for specific post
        }));
        
        console.log(`Post ${postId} liked`);
    
        try {
            const likeUrl = `https://weebform1-1dba705ec65b.herokuapp.com/like/${postId}`;
            const unlikeUrl = `https://weebform1-1dba705ec65b.herokuapp.com/unlike/${postId}`;
    
            // Use the updated likes state after setting it
            const isLiked = !likes[postId]; // Check the new like status
            const headers = {
                "Content-Type": "application/json",
                'Accept': "*/*",
                "Cache-Control": "no-cache",
                'Connection': "keep-alive",
                'Postman-Token': 've5465yrter546576879768uyt6756t3435',
                // 'Cookie' : `accessToken=${await getToken()},`
              };
            if (isLiked) {
                await axios.post(likeUrl, {
                    headers: { ...headers, Cookie: `accessToken=${Token}`}
                  });
                console.log('post liked');
            } else {
                await axios.post(unlikeUrl, {
                    headers: { ...headers, Cookie: `accessToken=${Token}` }
                });
                console.log('post unliked');
            }
        } catch (error) {
            console.error('Error liking/unliking post:', error);
        }
    }
    
    function showmore(){
        setMore(!more)
        console.log('show')
    }
    console.log('all posts')

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
                <Image style={styles.pfp} source={{uri: item.profilePic}} />
            </View>
            <View style={styles.topMiddle}>
                <View>
                    <Text style={styles.text}>{item.username}</Text>
                    <Text style={styles.text}>{item.tags}</Text>
                </View>
                <View><Text style={styles.follow}>Follow</Text></View>
            </View>
            </View>
            <View><Image source={require('../assets/more.png')} onTouchStart={showmore} /></View>
        </View>
        <View style={styles.middle}>
            <Text style={styles.maintext}>{item.description}</Text>
            <View>
            <Image 
            // style={styles.photo} 
            style={{width:'100%', height:200, objectFit:'cover'}}
            source={{uri: item.image}}
            onError={(error) => console.error('photo post error:', error.nativeEvent.error)}
             />
            </View>
            {/* <Text style={styles.date}>{convertDate(item.createdAt)}</Text> */}
        </View>
        <View style={styles.bottom}>
                            <View style={styles.reactionCon} onTouchStart={() => toggleLikePost(item.id)}>
                                <Image source={likes[item.id] ? require('../assets/liked.png') : require('../assets/like.png')} />
                                <Text style={{ ...styles.text2, color: likes[item.id] ? '#FF0808' : 'white' }}>
                                    {item.number_of_likes > 0 ? item.number_of_likes : 0}
                                </Text>
                            </View>
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
        // paddingHorizontal: 20,
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
        paddingHorizontal: 20,
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
        borderRadius: 50,
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
        lineHeight: 22,
        paddingHorizontal: 20,
    },
    date:{
        color: 'white',
        fontSize: 10,
    },
    middle:{
        paddingVertical: 0,
        flexDirection: 'column',
        gap: 20
        // paddingHorizontal: 20
    }, 
    photo:{
        width: '100%',
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