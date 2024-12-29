import { StyleSheet, Text, View , Image, TouchableOpacity} from 'react-native'
import React from 'react'
import { notificationData } from '../../constant/data'

const NotificationItem = ({ img, text, time, onImagePress, onOptionsPress }) => {

    const optionImg = require('../../assets/notoption.png')
    return (
      <View style={styles.notificationItem}>
       
        <TouchableOpacity onPress={onImagePress}>
          <Image source={img} style={styles.notificationImage} />
        </TouchableOpacity>
  
      
        <TouchableOpacity style={styles.notificationTextContainer}>
          <Text numberOfLines={1} style={styles.notificationText}>{text}</Text>
        </TouchableOpacity>
  
     
        <TouchableOpacity onPress={onOptionsPress} style={styles.notificationRight}>
          <View  style={styles.optionsButton}>
            <Image source={optionImg} style={styles.optionsButton}/>
          </View>
          <Text style={styles.notificationTime}>{time}</Text>
        </TouchableOpacity>
      </View>
    );
  };

export default NotificationItem

const styles = StyleSheet.create({
    notificationItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        // backgroundColor: "#fff",
        borderRadius: 8,
        elevation: 2,
        marginTop:6,
      },
      notificationImage: {
        width: 53,
        height: 53,
        borderRadius: 20,
        marginRight: 10,
      },
      notificationTextContainer: {
        flex: 1,
      },
      notificationText: {
        fontSize: 11,
        color: "#D9D9D9",
        fontWeight: "400",

      },
      notificationRight: {
        alignItems: "center",
       
      },
      optionsButton: {
        padding: 5,
      },
      optionsButton: {
        height:3,
        width:16,
      },
      notificationTime: {
        fontSize: 8,
        color: "#999898",
        
        fontWeight: "400",
        marginTop: 5,
      },
      separator: {
        height: 10,
      },
})