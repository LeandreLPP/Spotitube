const Client = require("discord.js").Client;
const https = require('https');
const client_secret = require("client_secret");
const querystring = require('querystring');

const bot = new Client();

bot.login(client_secret.discord_token);

bot.on('message', function(message) {
    // Detects a spotify link
    const regexSong = /https:\/\/open\.spotify\.com\/track\/(\w*)/;
    var res;
    if(res = message.content.match(regexSong)) {
        // extract the id of the song
        var id = res[1];

        console.log("Link spotify detected. ID="+id);
        identifySong(id, (song) => 
        {
            var authorsStr = "";
            song.authors.forEach(element => {
                authorsStr += element + ", ";
            });
            authorsStr = authorsStr.substring(0, authorsStr.length - 2);
            console.log("Song "+ id +" identified as \""+ song.name + "\" by " + authorsStr);
            searchYoutubeVideo(song, (video) =>
            {
                console.log("Video found: \""+video.name+"\" at code "+video.code);
                message.channel.send("https://www.youtube.com/watch?v="+video.code);
            })
        });
    }
}).on("error", (error) => {
    console.error("BOT ERROR: "+error);
});

const identifySong = function(id, callback) {
    getSpotifyToken((token) => {
        const options = {
            hostname: 'api.spotify.com',
            path: '/v1/tracks/'+id,
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        };
        var req = https.request(options, (res) => {
            var body = "";
            res.on("data", (chunk) => {
                body += chunk;
            }).on("end", () => {
                const obj = JSON.parse(body);
                var song = {
                    name : obj.name,
                    authors : []
                }
                obj.artists.forEach(element => {
                    song.authors.push(element.name);
                });
                callback(song);
            }).on("error", (error) => { 
                console.error("RESPONSE ERROR: "+error) 
            });
        });
        req.end();
    });
}

const getSpotifyToken = function(callback) {
    const credential = client_secret.spotify_ID + ":" + client_secret.spotify_secret;
    const credential64 = Buffer.from(credential).toString('base64');
    const postData = querystring.stringify({ 'grant_type': 'client_credentials' });
    const options = {
        hostname: 'accounts.spotify.com',
        path: '/api/token',
        method: 'POST',
        headers: {
            'Content-Type':'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + credential64
        }
    };
    var req = https.request(options, (res) => {
        var body = "";
        res.on("data", (chunk) => {
            body += chunk;
        }).on("end", () => {
            const obj = JSON.parse(body);
            const token = obj.access_token;
            callback(token);
        }).on("error", (error) => { 
            console.error("RESPONSE ERROR: "+error) 
        });
    });
    req.write(postData);
    req.end();
}

const searchYoutubeVideo = function(song, callback) {
    var searchTerms = song.name;
    song.authors.forEach(element => searchTerms += " "+element);
    var getData = querystring.stringify({ 
        'q': searchTerms,
        'maxResults': 1,
        'part':'snippet',
        'key': client_secret.google_key
    });
    var url = "https://www.googleapis.com/youtube/v3/search?"+getData;
    var req = https.request(url, (res) => {
        var body = "";
        res.on("data", (chunk) => {
            body += chunk;
        }).on("end", () => {
            const obj = JSON.parse(body);
            const item = obj.items[0];
            var video = {
                name: item.snippet.title,
                code: item.id.videoId
            }
            callback(video);
        }).on("error", (error) => { 
            console.error("RESPONSE ERROR: "+error) 
        });
    });
    req.end();
}