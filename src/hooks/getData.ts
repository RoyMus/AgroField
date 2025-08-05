import { useState, useEffect } from 'react';

let isTemplate = null;
let plant = null;
let grower = null;
let place = null;
export const getData = (shouldSet, template, plantName, growerName, placeName) => {
    if (shouldSet == true){
        isTemplate = template;
        plant = plantName;
        grower = growerName;
        place = placeName;
    }

    return {
    isTemplate,
    plant,
    grower,
    place,
    };
};