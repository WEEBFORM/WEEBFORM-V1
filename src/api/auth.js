import * as SecureStore from 'expo-secure-store';
import axios from "axios";

// const baseUrl = `https://weebform1-1dba705ec65b.herokuapp.com/api/v1/user`;
const baseUrl = `https://weebform1-1dba705ec65b.herokuapp.com/api/v1/user`;
const headers = {
  "Content-Type": "application/json",
  'Accept': "*/*",
  "Cache-Control": "no-cache",
  'Connection': "keep-alive",
  'Postman-Token': 've5465yrter546576879768uyt6756t3435'
};

export const login = async (credentials, navigation) =>{
      await axios
      .post(
        `${baseUrl}/login`,
        credentials,
        {
          headers : headers
        }
      )
      .then(async (res) => {
        console.log('connection success')
        console.log(res.data.token)
        await SecureStore.setItemAsync("Token", res.data.token);
        navigation.replace('Main')
      })
      .catch(e => { // catch should be in lowercase 
        console.log('Failed to login', e.status);
      });
}

export const createAcct = async (credentials, navigation) =>{
      await axios
      .post(
        `${baseUrl}/create`,
        credentials,
        {
          headers : headers
        }
      )
      .then(async (res) => {
        console.log(res)
        console.log('connection success')
        await SecureStore.setItemAsync("Token", res.data.token);
        navigation.replace('Otp')
      })
      .catch(e => { // catch should be in lowercase
        console.log('Failed to create Account', e);
      });
}

export const updatePrtofile = async (credentials) =>{
      await axios
      .post(
        `${baseUrl}/create`,
        credentials,
        {
          headers : headers
        }
      )
      .then(async (res) => {
        console.log(res)
        console.log('connection success')
        await SecureStore.setItemAsync("Token", res.data.token);
        navigation.replace('Otp')
      })
      .catch(e => { // catch should be in lowercase
        console.log('Failed to create Account', e);
      });
}

export const editProfile = async (formData, id) =>{
  try {
    const Token = await SecureStore.getItemAsync("Token");
    const response = await axios.put(`${baseUrl}/${id}`, formData, {
      headers: { ...headers, Cookie: `accessToken=${Token}` }
    });
    console.log('true', response.data);
    return response.data; // This will properly return the data
  } catch (e) {
    console.log('Failed to get user profile', e);
    return null; // Ensure to return a value in case of an error
  }
}

export const otp = async (credentials, navigation) =>{
      await axios
      .post(
        `${baseUrl}/register`,
        credentials,
        {
          headers : headers
        }
      )
      .then(async (res) => {
        console.log(res)
        console.log('connection success')
        navigation.replace('Main')
      })
      .catch(e => { // catch should be in lowercase
        console.log('Failed to create Account', e);
      });
}

export const forgotPassword = async (credentials, navigation) =>{
      await axios
      .post(
        `${baseUrl}/forgot-password`,
        credentials,
        {
          headers : headers
        }
      )
      .then(async (res) => {
        console.log(res)
        navigation.replace('Forgotpasswordmail')
        console.log('nav error')
      })
      .catch(e => { // catch should be in lowercase
        console.log('Failed to reset password', e);
      });
}

export const getUserData = async () => {
  try {
    const Token = await SecureStore.getItemAsync("Token");
    const response = await axios.get(`${baseUrl}/user`, {
      headers: { ...headers, Cookie: `accessToken=${Token}` }
    });
    console.log('true', response.data);
    return response.data; // This will properly return the data
  } catch (e) {
    console.log('Failed to get user profile', e);
    return null; // Ensure to return a value in case of an error
  }
};

