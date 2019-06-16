const Client = require("discord.js").Client;
const fs = require('fs');
const Spotify = require("./api/spotify.js");
const Youtube = require("./api/youtube.js");
require('dotenv').config();

const bot = new Client();

bot.login(process.env.DISCORD_TOKEN);

bot.on('message', function(message) {
    // Detects a spotify link
    const regexSong = /https:\/\/open\.spotify\.com\/track\/(\w*)/;
    const regexArtist = /https:\/\/open\.spotify\.com\/artist\/(\w*)/;
    const regexAlbum = /https:\/\/open\.spotify\.com\/album\/(\w*)/;
    var res;
    if(res = message.content.match(regexSong)) {
        // extract the id of the song
        var id = res[1];

        console.log("Link for a spotify SONG detected. ID="+id);
        searchSingleSong(id, 
            (video) => message.channel.send("https://www.youtube.com/watch?v="+video.code), 
            getCallbackError(message.channel, "Donnez moi un un lien valide, bondiou !"), 
            getCallbackError(message.channel, "J'ai pô trouvé de vidéo qui corresponde... Désolé.")
        );

    } else if(res = message.content.match(regexArtist)) {
        // extract the id of the artist
        var id = res[1];
        console.log("Link for an ARTIST on spotify detected. ID="+id);
        searchArtist(id, 
            (ytChannel) => message.channel.send("https://www.youtube.com/channel/" + ytChannel.code), 
            getCallbackError(message.channel, "Ha ha ha, il a cru que son lien fonctionnait !"), 
            getCallbackError(message.channel, "La recherche de chaine correspondante a échoué. Toutes mes excuses.")
        );

    } else if(res = message.content.match(regexAlbum)) {
        // extract the id of the album
        var id = res[1];

        console.log("Link for a spotify ALBUM detected. ID="+id);
        searchAlbum(id, message,
            getCallbackError(message.channel, "Mais... Ton album là... Il existe pas !"), 
            getCallbackError(message.channel, "La recherche d'album n'a pas été fructueuse. Je fais de mon mieux, c'est promis !")
        );
    }
}).on("error", (error) => {
    console.error("BOT ERROR: "+error);
}).on('ready', () => {
    console.log('Jacked up and good to go.');
}).on('reconnecting', () => {
    console.log('Hey, how\'d I get here?');
});

const getCallbackError = function (channel, errorMessage) {
    return ((error) => {
        channel.send(errorMessage);
        if(error.stack) {
            console.error("ERROR: " + error.stack);
        } else {
            console.error("ERROR: " + error);
        }
    });
}

const searchSingleSong = function(idSong, callback, errSpotify, errYoutube) {
    getDb('songs', (db) => {
        if (db.data[idSong]) { // If the song as already been found
            var video = db.data[idSong];
            console.log("Video loaded from memory: \""+video.name+"\" at youtube code "+video.code);
            callback(video);
        } else {
            // Get the song on the spotify API
            Spotify.identifySong(idSong, (song) => {
                // Concatenate the authors
                var authorsStr = "";
                song.authors.forEach(element => {
                    authorsStr += element + ", ";
                });
                authorsStr = authorsStr.substring(0, authorsStr.length - 2);
                // Search on Youtube
                console.log("Song of id "+ idSong +" identified as \""+ song.name + "\" by " + authorsStr);
                Youtube.searchVideo(song, (video) =>{
                    console.log("Video found: \""+video.name+"\" at youtube code "+video.code);
                    // Write in memory
                    db.data[idSong] = video;
                    writeDb(db, () => {
                        console.log("Saved !");
                        callback(video);
                    }, err => console.log(err));
                }, errYoutube);
            }, errSpotify);
        }
    }, err => console.log(err));
}

const searchArtist = function(idArtist, callback, errSpotify, errYoutube) {
    getDb('artists', (db) => {
        if (db.data[idArtist]) { // If the artist as already been found
            var channel = db.data[idArtist];
            console.log("Youtube channel loaded from memory: \""+channel.name+"\" at youtube code "+channel.code);
            callback(channel);
        } else {
            // Get the artist on the spotify API
            Spotify.identifyArtist(idArtist, (artistName) => {
                // Search on Youtube
                console.log("Artist of id " + idArtist + " identified as " + artistName);
                Youtube.searchChannel(artistName, (channel) => {
                    console.log("Youtube channel found: \"" + channel.name + "\" at youtube code "+ channel.code);// Write in memory
                    db.data[idArtist] = channel;
                    writeDb(db, () => {
                        console.log("Saved !");
                        callback(channel);
                    }, err => console.log(err));
                }, errYoutube);
            }, errSpotify);
        }
    }, err => console.log(err));
}

const searchAlbum = function(idAlbum, message, errSpotify, errYoutube) {
    getDb('albums', (db) => {
        if (db.data[idAlbum]) { // If the song as already been found
            var youtubeUrl = db.data[idAlbum];
            console.log(`Loaded from DB`);
            message.channel.send(youtubeUrl);
        } else {
            Spotify.identifyAlbum(idAlbum, (album) => 
            {
                console.log(`Album of id ${idAlbum} identified as ${album.name} by ${album.artists.join(", ")} (${album.totalTracks} tracks)`);
                Youtube.searchAlbum(album, (result) => {
                    Youtube.generateAnonymousPlaylist(result.videoCodes, `${album.name} · ${album.artists.join(", ")}`, function(youtubeUrl) {
                        db.data[idAlbum] = youtubeUrl;
                        writeDb(db, () => {
                            console.log("Saved !");
                            message.channel.send(youtubeUrl);
                        }, err => console.log(err));

                        if(result.notFoundCount > 0) {
                            message.channel.send(`Je n'ai pas réussi à trouver ${result.notFoundCount} chansons de l'album :worried:`);
                        }
                    });
                }, errYoutube);

            }, errSpotify);
        }
    }, err => console.log(err));
}

const getDb = function (name, callback, callbackError) {
    var filePath = './db/'+name+'.js';
    var readFile = () => fs.readFile(filePath, 'utf8', function (err, data) {
        if (err) callbackError(err);
        else callback(JSON.parse(data));
    });
    fs.exists(filePath, (exists) => {
        if (!exists)
            fs.writeFile(filePath, JSON.stringify({ name: name, data: {} }), err => {
                if (err) callbackError(err);
                else readFile();
            });
        else readFile();
    })
}

const writeDb = function (db, callback, callbackError) {
    var filePath = './db/'+db.name+'.js';
    fs.writeFile(filePath, JSON.stringify(db), err => {
        if (err) callbackError(err);
        else callback();
    });
}