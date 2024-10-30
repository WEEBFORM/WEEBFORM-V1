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
const Token = await SecureStore.getItemAsync("Token");

export const getUserData = async () =>{
    await axios
    .get(
      `${baseUrl}/user`,
      {
        headers : {...headers, Cookie : `accessToken=${Token}`}
      }
    )
    .then(async (res) => {
      console.log(res)
    })
    .catch(e => {
      console.log('Failed to reset password', e);
    });
}