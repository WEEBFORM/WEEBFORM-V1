import { View, Text, FlatList } from 'react-native'
import React from 'react'
import Container from '../../../../components/ui/container'
import { communityData } from '../../../../constant/data'
import GapComponent from '../../../../components/gap-component'
import CommunityList from '../../../../components/community-list'
import { ms } from 'react-native-size-matters'

const chatGroup = () => {
  return (
    <Container style={{marginTop: 27}}>
      <FlatList
        data={communityData}
        numColumns={1}
        snapToAlignment="start"
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <GapComponent height={ms(8)} />}
        renderItem={({ item }) => (
          <CommunityList
            name={item.name}
            categories={item.categories}
            img={item.img}
            time={item.time}
            members={item.img}
          />
        )}
      />
   </Container>
  )
}

export default chatGroup