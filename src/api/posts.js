import * as SecureStore from 'expo-secure-store';
import axios, { all } from "axios";

const baseUrl = `https://weebform1-1dba705ec65b.herokuapp.com/api/v1/posts`;
async function getToken(){
    try{
      const credentials = await SecureStore.getItemAsync("Token");
      console.log(credentials, 'tokeennn')
      return credentials
    }catch(e){
      console.log(e)
    }
  }

  const headers = {
    "Content-Type": "application/json",
    'Accept': "*/*",
    "Cache-Control": "no-cache",
    'Connection': "keep-alive",
    'Postman-Token': 've5465yrter546576879768uyt6756t3435',
    // 'Cookie' : `accessToken=${await getToken()},`
  };

export const getAllPosts = async () => {
  try {
    const Token = await SecureStore.getItemAsync("Token");
    const response = await axios.get(`${baseUrl}`, {
      headers: { ...headers, Cookie: `accessToken=${Token}` }
    });
    console.log('true', response.data);
    return response.data; // This will properly return the data
  } catch (e) {
    console.log('Failed to get user profile', e);
    return null; // Ensure to return a value in case of an error
  }
  };

export const getUserPosts = async () => {
    try {
      const res = await axios.get(
        `${baseUrl}/user/${id}`,
        {
          headers
        }
      );
      return res.data;
    } catch (e) {
      console.log(e);
      return null; // Or handle the error as needed
    }
  };

export const getUserPostsByCategory = async () => {
    try {
      const res = await axios.get(
        `${baseUrl}/adventure`,
        {
          headers
        }
      );
      return res.data;
    } catch (e) {
      console.log(e);
      return null; // Or handle the error as needed
    }
  };

export const getUserPostsByFollowing = async () => {
    try {
      const res = await axios.get(
        `${baseUrl}/following/${id}`,
        {
          headers
        }
      );
      return res.data;
    } catch (e) {
      console.log(e);
      return null; // Or handle the error as needed
    }
  };

