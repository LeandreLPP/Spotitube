const Client = require("discord.js").Client;
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
        Spotify.identifySong(id, (song) => 
        {
            var authorsStr = "";
            song.authors.forEach(element => {
                authorsStr += element + ", ";
            });
            authorsStr = authorsStr.substring(0, authorsStr.length - 2);
            console.log("Song of id "+ id +" identified as \""+ song.name + "\" by " + authorsStr);
            Youtube.searchVideo(song, (video) =>
            {
                console.log("Video found: \""+video.name+"\" at youtube code "+video.code);
                message.channel.send("https://www.youtube.com/watch?v="+video.code);
            }, getCallbackError(message.channel, "J'ai pô trouvé de vidéo qui corresponde... Désolé."))
        }, getCallbackError(message.channel, "Donnez moi un un lien valide, bondiou !"));

    } else if(res = message.content.match(regexArtist)) {
        // extract the id of the artist
        var id = res[1];
        console.log("Link for an ARTIST on spotify detected. ID="+id);
        Spotify.identifyArtist(id, (artistName) => {
            console.log("Artist of id " + id + " identified as " + artistName);
            Youtube.searchChannel(artistName, (channel) => {
                console.log("Youtube channel found: \"" + channel.name + "\" at youtube code "+ channel.code);
                message.channel.send("https://www.youtube.com/channel/" + channel.code);
            }, getCallbackError(message.channel, "La recherche de chaine correspondante a échoué. Toutes mes excuses."));
        }, getCallbackError(message.channel, "Ha ha ha, il a cru que son lien fonctionnait !"));
    } else if(res = message.content.match(regexAlbum)) {
        // extract the id of the album
        var id = res[1];

        console.log("Link for a spotify ALBUM detected. ID="+id);
        Spotify.identifyAlbum(id, (album) => 
        {
            console.log(`Album of id ${id} identified as ${album.name} by ${album.artists.join(", ")} (${album.totalTracks} tracks)`);
            Youtube.searchAlbum(album, (result) => {
                Youtube.generateAnonymousPlaylist(result.videoCodes, `${album.name} · ${album.artists.join(", ")}`, function(youtubeUrl) {
                    message.channel.send(youtubeUrl);

                    if(result.notFoundCount > 0) {
                        message.channel.send(`Je n'ai pas réussi à trouver ${result.notFoundCount} chansons de l'album :worried:`);
                    }
                });
            }, getCallbackError(message.channel, "La recherche d'album n'a pas été fructueuse. Je fais de mon mieux, c'est promis !"));

        }, getCallbackError(message.channel, "Mais... Ton album là... Il existe pas !"));
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