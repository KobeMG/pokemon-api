const express = require('express');
const app = express();
const axios = require('axios');
const fs = require('fs');
require('dotenv').config(); //ENV variables
//Instagram 
const { IgApiClient } = require('instagram-private-api');
const Jimp = require("jimp");
const { readFile } = require('fs');
const { promisify } = require('util');
const readFileAsync = promisify(readFile);

//Server
app.use(express.json());
const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
    //postImage();
});
// End points
app.get('/hello', (req, res) => {
    res.send('Hello World!');
});

app.get("/send", (req, res) => {
    postPokemon();
    res.send(`POSTING POKEMON AT....${new Date()}`);
});

//Pokemon API
const fethPokemonData = async () => {
    const id = await randomPokemon();
    try {
        const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`); //feth pokemon data
        const { name, abilities } =  res.data;
        //get the pokemon skills
        const skills = abilities.map((skill) => {
            return skill.ability.name;
        });
        //return skills in a string
        const skillsString = skills.join(" - ");
        //return the pokemon description in english
        const resDescription = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`); //feth pokemon data
        const { flavor_text_entries } = resDescription.data;
        const { flavor_text } = flavor_text_entries.find((description) => description.language.name === "en");
        const caption = `Name: ${name} \n\nSkills: ${skillsString} \n\nDescription: ${flavor_text} \n\n #pokemon #nodejs #javascript #pikachu #pokemongo`;
        await writePokemonImage(id);
        return caption;
    } catch (error) {
        console.log(error);
        console.log(`Error with pokemon id: ${id}`);
    }
    return "no data";
}

const writePokemonImage = async (id) => {
    const formatedId = id.toString().padStart(3, '0');
    console.log(`Searching a pokemon with id ${formatedId}`);
    const image = await Jimp.read(`https://assets.pokemon.com/assets/cms2/img/pokedex/detail/${formatedId}.png`);
    await image.writeAsync('pokemon.jpg');
    console.log("Image downloaded 📷");
}


const randomPokemon = async() => {
    
    const random = Math.floor(Math.random() * 905) + 1;
    const pokemonPosted = await checkPokemonsPosted(random);
    if (pokemonPosted) {
        console.log(`Pokemon already posted: ${random}`);
        randomPokemon();
    }else{
        console.log(`Pokemon id: ${random} not posted`);
        return random;
    }
}

const checkPokemonsPosted = async (id) => {
    const pokemonsPosted = await readFileAsync('./pokemonsPosted.txt', 'utf8');
    const pokemonsPostedArray = JSON.parse(pokemonsPosted);
    const isPosted = pokemonsPostedArray.includes(id);
    if(!isPosted){
        pokemonsPostedArray.push(id);
        fs.writeFileSync('./pokemonsPosted.txt', JSON.stringify(pokemonsPostedArray));
        return false;
    }
    return isPosted;
}

//Post pokemon to Instagram
const postPokemon = async () => {
    const ig = new IgApiClient();
    try {
        console.log("Logging in...");
        ig.state.generateDevice(process.env.INSTAGRAM_USERNAME);
        await ig.account.login(process.env.INSTAGRAM_USERNAME, process.env.INSTAGRAM_PASSWORD);
        const caption = await fethPokemonData(); 
        const published = await ig.publish.photo({
            file: await readFileAsync("pokemon.jpg"),
            caption: caption
        });
        deleteFile("pokemon.jpg");
        if (published) {
            console.log("Image posted 😍");
        }
    } catch (error) {
        console.log("Oh no! Something went wrong: ");
        console.log(error);
    }
}
//General function
const deleteFile = (path) => {
    try {
        fs.unlinkSync(path)
        console.log('File removed')
    } catch (err) {
        console.error('Something wrong happened removing the file', err)
    }
};





