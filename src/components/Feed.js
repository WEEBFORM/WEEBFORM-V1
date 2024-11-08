import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View,Image, SafeAreaView, ImageBackground, ScrollView} from "react-native";
import { Globalstyles } from '../Styles/globalstyles';
import TopNav from './TopNav';
import Photopost from './Photopost';
import Nav from './Nav';
import Story from './Story/Story';
import MorePost from './MorePost';
import Sidebar from './Sidebar';
import { getAllPosts } from '../api/posts';
import { getUserPostsByFollowing } from '../api/posts';
import axios from 'axios'
// const Tab = createBottomTabNavigator();


const Feed = () => {
  const [allPost, setAllPosts] = useState()
  const [newPost, setNewPosts] = useState()
  const [sideBar, setSideBar] = useState(false)

  useEffect(() => {
    const fetchPosts = async () => {
      const posts = await getAllPosts();
      console.log('posts', posts)
      const newposts = await getUserPostsByFollowing()
      if (posts) {
        setAllPosts(posts);
        console.log('allpost', posts[0]) 
      }
      if(newposts){
        setNewPosts(newposts)
      }
    };
    fetchPosts();
  }, []);
  // console.log('logging', allPost)
  // console.log('logging', await getAllPosts())


  function openCloseSideBar(){
    setSideBar(!sideBar) 
    console.log('sidebar')
  }
  function closesidebar(){
    setSideBar(false)
    console.log('sidebar')
  }
  return (
    <SafeAreaView style={Globalstyles.Home}>
    {
      sideBar && <Sidebar/>
    }
    <TopNav sidebar={openCloseSideBar} />
    <Story/>
    {/* <Nav/> */}
    <Photopost allpost={allPost} newpost={newPost}/>
</SafeAreaView>
  )
}

export default Feed