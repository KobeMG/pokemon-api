const express = require("express");
const app = express();
const axios = require("axios");
const fs = require("fs");
require("dotenv").config(); //ENV variables
//Instagram
const { IgApiClient } = require("instagram-private-api");
const Jimp = require("jimp");
const { readFile } = require("fs");
const { promisify } = require("util");
const readFileAsync = promisify(readFile);

//firebase
const { db } = require("./firebase");

const addToFirebase = async (id, name) => {
  await db.collection("pokemons").add({
    ID: id,
    Name: name,
  });
};

const readFromFirebase = async () => {
  console.log("Reading from firebase");
  const snapshot = await db.collection("pokemons").get();
  const pokemons = [];
  snapshot.docs.forEach((doc) => {
    pokemons.push(doc.data().ID);
  });
  return pokemons;
};
const deleteCollection = async () => {
  //WARNING: This function will delete all the data in the collection
  //Delete all the pokemons in the collection
  const snapshot = await db.collection("pokemons").get();
  snapshot.docs.forEach((doc) => doc.ref.delete());
};

//Server
app.use(express.json());
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
// End points
app.get("/hello", (req, res) => {
  res.send("Hello World!");
});

app.get("/send", (req, res) => {
  postPokemon();
  res.send(`POSTING POKEMON AT....${new Date()}`);
});

app.get("/read", (req, res) => {
  console.log("------------------------");
  readFromFirebase().then((data) => {
    console.log(data);
    res.send("Check the console");
  });
});

//Pokemon API
const fethPokemonData = async () => {
  const id = await randomPokemon();
  try {
    const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`); //feth pokemon data
    const { name, abilities } = res.data;
    //get the pokemon skills
    const skills = abilities.map((skill) => {
      return skill.ability.name;
    });
    //return skills in a string
    const skillsString = skills.join(" - ");
    //return the pokemon description in english
    const resDescription = await axios.get(
      `https://pokeapi.co/api/v2/pokemon-species/${id}`
    ); //feth pokemon data
    const { flavor_text_entries } = resDescription.data;
    const { flavor_text } = flavor_text_entries.find(
      (description) => description.language.name === "en"
    );
    const caption = `A wild ${name} appeared!\nID: ${id}\n\nSkills: ${skillsString} \n\nDescription: ${flavor_text} \n\n #pokemon #nodejs #javascript #pikachu #pokemongo`;
    console.log("A wild pokemon appeared!");
    await writePokemonImage(id);
    return caption;
  } catch (error) {
    console.log(error);
    console.log(`Error with pokemon id: ${id}`);
  }
  return "no data";
};

const writePokemonImage = async (id) => {
  const formatedId = id.toString().padStart(3, "0");
  console.log(`Searching a pokemon with id ${formatedId}`);
  const image = await Jimp.read(
    `https://assets.pokemon.com/assets/cms2/img/pokedex/detail/${formatedId}.png`
  );
  await image.writeAsync("pokemon.jpg");
  console.log("Image downloaded 📷");
};

const randomPokemon = async () => {
  const pokemonsPosted = await readFromFirebase();
  while (true) {
    const random = Math.floor(Math.random() * 905) + 1;
    const alreadyPosted = pokemonsPosted.includes(random.toString());
    if (!alreadyPosted) {
      console.log(`Pokemon id: ${random} not posted`);
      addToFirebase(random.toString(), "Added from the server");
      return random;
    }
    if (pokemonsPosted.length === 905) {
      console.log("All pokemons posted");
      deleteCollection(); //WARNING: This function will delete all the data in the collection
      addToFirebase(random.toString(), "First-added from the server"); //Add the first pokemon and start again
      return random;
    }
    console.log(`Pokemon already posted: ${random}, searching another one`);
  }
};

//Post pokemon to Instagram
const postPokemon = async () => {
  const ig = new IgApiClient();
  try {
    console.log("Logging in...");
    ig.state.generateDevice(process.env.INSTAGRAM_USERNAME);
    await ig.account.login(
      process.env.INSTAGRAM_USERNAME,
      process.env.INSTAGRAM_PASSWORD
    );
    const caption = await fethPokemonData();
    const published = await ig.publish.photo({
      file: await readFileAsync("pokemon.jpg"),
      caption: caption,
    });
    deleteFile("pokemon.jpg");
    if (published) {
      console.log("Image posted 😍");
    }
  } catch (error) {
    console.log("Oh no! Something went wrong: ");
    console.log(error);
  }
};
//General function
const deleteFile = (path) => {
  try {
    fs.unlinkSync(path);
    console.log("File removed");
  } catch (err) {
    console.error("Something wrong happened removing the file", err);
  }
};
