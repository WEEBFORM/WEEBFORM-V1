import React from 'react'
import { StyleSheet, Text, View, SafeAreaView, Image, TextInput, FlatList } from "react-native";



const EachNews = () => {
    const data = [
        {
            id: 1,
            title: 'Fairy Tale Anime News',
            date: 'May 24, 2024',
            snippet: '100 years Quest” Anime Reveals More Cast, July 7 Premire 3 more cast members and the new visuals.'
        },
        {
            id: 2,
            title: 'Fairy Tale Anime News',
            date: 'May 24, 2024',
            snippet: '100 years Quest” Anime Reveals More Cast, July 7 Premire 3 more cast members and the new visuals.'
        },
        {
            id: 3,
            title: 'Fairy Tale Anime News',
            date: 'May 24, 2024',
            snippet: '100 years Quest” Anime Reveals More Cast, July 7 Premire 3 more cast members and the new visuals.'
        },
        {
            id: 4,
            title: 'Fairy Tale Anime News',
            date: 'May 24, 2024',
            snippet: '100 years Quest” Anime Reveals More Cast, July 7 Premire 3 more cast members and the new visuals.'
        },
    ]
  return (
    <View>
    <FlatList
        data={data}
        horizontal
        renderItem={({item})=>(
            <View style={styles.layout} >
            <View style={styles.top}>
                <Image source={require('./../assets/newspfp.png')} />
                <View>
                    <Text style={styles.titletext}>Title</Text>
                    <Text style={{color: '#999898'}}>date</Text>
                </View>
            </View>
            <Text style={styles.snippet}>
                snippet est” Anime Reveals More Cast, July 7 Premire 3 more cast me
            </Text>
        </View>
        )}
        keyExtractor={item => item.id}
    />
    </View>
  )
}

const styles = StyleSheet.create({
    layout:{
        borderWidth: '3px',
        borderColor: '#1A1A1A',
        flexDirection: 'column',
        padding: 10,
        marginRight: 15,
        paddingBottom: 20,
        borderRadius: 20,
        gap: 6,
        width: 350
    },
    top:{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5
    },
    titletext:{
        color: '#D9D9D9',
        fontSize: '20px',
        marginBottom: 3,
        fontWeight: '700'
    },
    snippet:{
        color: '#999898',
        marginLeft: 10
    },
})

export default EachNews