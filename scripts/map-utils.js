function getColor(category) {
  if (category === 'parcours') {
    return '#35978f';
  } else if (category === 'chemin_boueux') {
    return '#542788';
  } else if (category === 'chemin_inondable') {
    return '#fdb863';
  } else if (category === 'danger') {
    return '#b30000';
  } else {
    return 'pink';
  }
}

function getWeight(category) {
  if (category === 'parcours') {
    return 8;
  } else if (category === 'chemin_boueux') {
    return 10;
  } else if (category === 'chemin_inondable') {
    return 10;
  } else if (category === 'danger') {
    return 11;
  } else {
    return 8;
  }
}

export { getColor, getWeight };
