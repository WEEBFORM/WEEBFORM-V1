import * as SecureStore from 'expo-secure-store';
import axios from "axios";

const baseUrl = `http://localhost:8000/api/v1/user`;
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
        console.log('Failed to login', e);
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

