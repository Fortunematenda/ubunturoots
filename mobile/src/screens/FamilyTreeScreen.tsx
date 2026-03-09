import { Alert, StyleSheet, Text, View } from 'react-native';
import { FamilyTreeEngine, type FamilyTreeNode } from '../components/tree/FamilyTreeEngine';

const familyData: FamilyTreeNode = {
  id: 'you',
  name: 'Fortune Matenda',
  spouse: {
    id: 'spouse',
    name: 'Brenda Gwari'
  },
  children: [
    {
      id: 'child1',
      name: 'Child One'
    }
  ]
};

export function FamilyTreeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Family Tree</Text>
      <FamilyTreeEngine
        data={familyData}
        onAddPress={(node) => {
          Alert.alert('Add Relative', `Add a relative for ${node.name}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F5',
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F3D33',
    marginBottom: 16
  }
});
