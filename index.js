const express = require("express");
const app = express();
const fetch = require("node-fetch");
const fs = require("fs");
require("dotenv").config(); //ENV variables

//Twitter
const Twitter = require("twit");
const twitter = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
});

const Jimp = require("jimp");
const { readFile } = require("fs");
const { promisify } = require("util");
const readFileAsync = promisify(readFile);

//firebase
const { db } = require("./firebase");

const addToFirebase = async (id) => {
  //fetch the pokemon name and add it to the collection
  const endPoint = `https://pokeapi.co/api/v2/pokemon/${id}`;
  const res = await fetch(endPoint);
  const data = await res.json();
  const { name } = data;

  await db.collection("pokemons").add({
    ID: id,
    Date: new Date(),
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
  postTweet();
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
    await writePokemonImage(id);
    const endPoint = `https://pokeapi.co/api/v2/pokemon/${id}`;
    const res = await fetch(endPoint);
    const data = await res.json();
    const { name, abilities } = data;
    //get the pokemon skills
    const skills = abilities.map((skill) => {
      return skill.ability.name;
    });
    //return skills in a string
    const skillsString = skills.join(" - ");
    const caption = `A wild ${name} appeared!\nID: ${id}\nAbilities: ${skillsString} \n\n #pokemon #nodejs #javascript #pikachu #pokemongo`;
    console.log("A wild pokemon appeared!");
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
      addToFirebase(random.toString());
      return random;
    }
    if (pokemonsPosted.length === 905) {
      console.log("All pokemons posted");
      deleteCollection(); //WARNING: This function will delete all the data in the collection
      addToFirebase(random.toString()); //Add the first pokemon and start again
      return random;
    }
    console.log(`Pokemon already posted: ${random}, searching another one`);
  }
};

//post a tweet with a pokemon
const postTweet = async () => {
  try {
    const status = await fethPokemonData();
    const mediaFile = await readFileAsync("pokemon.jpg");
    const base64image = Buffer.from(mediaFile).toString("base64");
    const post = await twitter.post("media/upload", {
      media_data: base64image,
    });
    const mediaId = post.data.media_id_string;
    await twitter.post("statuses/update", {
      status: status,
      media_ids: mediaId,
    });
    console.log("Tweet posted 🐦");
    deleteFile("pokemon.jpg");
  } catch (error) {
    console.log(error);
  }
};

const deleteFile = (path) => {
  try {
    fs.unlinkSync(path);
    console.log("File removed");
  } catch (err) {
    console.error("Something wrong happened removing the file", err);
  }
};
