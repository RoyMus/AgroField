import { useState, useEffect } from 'react';

let isTemplate = null;
let plant = null;
let grower = null;
let place = null;
export const getData = (shouldSet, template, plantName, growerName, placeName) => {
    if (isTemplate == null)
        isTemplate = JSON.parse(localStorage.getItem('isTemplate'));
    if (plant == null)
        plant = JSON.parse(localStorage.getItem('plant'));
    if (grower == null)
        grower = JSON.parse(localStorage.getItem('grower'));
    if (place == null)
        place = JSON.parse(localStorage.getItem('place'));

    if (shouldSet == true){
        isTemplate = template;
        plant = plantName;
        grower = growerName;
        place = placeName;
        localStorage.setItem('isTemplate', JSON.stringify(isTemplate));
        localStorage.setItem('plant', JSON.stringify(plant));
        localStorage.setItem('grower', JSON.stringify(grower));
        localStorage.setItem('place', JSON.stringify(place));
    }

    return {
        isTemplate,
        plant,
        grower,
        place,
    };
};