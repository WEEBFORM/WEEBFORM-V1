import * as SecureStore from 'expo-secure-store';
import axios from "axios";


const baseUrl = `https://weebform1-1dba705ec65b.herokuapp.com/api/v1/user`;
const headers = {
  "Content-Type": "application/json",
  'Accept': "*/*",
  "Cache-Control": "no-cache",
  'Connection': "keep-alive",
  'Postman-Token': 've5465yrter546576879768uyt6756t3435'
};
const Token = await SecureStore.getItemAsync("Token");  

