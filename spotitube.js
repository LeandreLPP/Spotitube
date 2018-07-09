const Client = require("discord.js").Client;
const https = require('https');
const client_secret = require("client_secret");
const querystring = require('querystring');

const bot = new Client();

bot.login(client_secret.discord_token);

bot.on('message', function(message) {
    // Detects a spotify link
    const regexSong = /https:\/\/open\.spotify\.com\/track\/(\w*)/;
    const regexArtist = /https:\/\/open\.spotify\.com\/artist\/(\w*)/;
    var res;
    if(res = message.content.match(regexSong)) {
        // extract the id of the song
        var id = res[1];

        console.log("Link for a spotify SONG detected. ID="+id);
        identifySong(id, (song) => 
        {
            var authorsStr = "";
            song.authors.forEach(element => {
                authorsStr += element + ", ";
            });
            authorsStr = authorsStr.substring(0, authorsStr.length - 2);
            console.log("Song of id "+ id +" identified as \""+ song.name + "\" by " + authorsStr);
            searchYoutubeVideo(song, (video) =>
            {
                console.log("Video found: \""+video.name+"\" at youtube code "+video.code);
                message.channel.send("https://www.youtube.com/watch?v="+video.code);
            })
        });
    } else if(res = message.content.match(regexArtist)) {
        // extract the id of the artist
        var id = res[1];
        console.log("Link for an ARTIST on spotify detected. ID="+id);
        identifyArtist(id, (artistName) => {
            console.log("Artist of id " + id + " identified as " + artistName);
            searchYoutubeChannel(artistName, (channel) => {
                console.log("Youtube channel found: \"" + channel.name + "\" at youtube code "+ channel.code);
                message.channel.send("https://www.youtube.com/user/"+channel.code);
            });
        });
    }
}).on("error", (error) => {
    console.error("BOT ERROR: "+error);
}).on('ready', () => {
    console.log('Jacked up and good to go.');
}).on('reconnecting', () => {
    console.log('Hey, how\'d I get here?');
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

const identifyArtist = function(id, callback) {
    getSpotifyToken((token) => {
        const options = {
            hostname: 'api.spotify.com',
            path: '/v1/artists/'+id,
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
                var name = obj.name;
                callback(name);
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
        'type': 'video',
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

const searchYoutubeChannel = function(artistName, callback) {
    var getData = querystring.stringify({ 
        'type': 'channel',
        'q': artistName,
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
            if(obj.items.length > 0) 
            {
                console.log("Youtube channel is ID "+obj.items[0].id.channelId);
                getYoutubeChannelCustomURL(obj.items[0].id.channelId, callback);
            } else {
                errorCallback();
            }
        }).on("error", (error) => console.log("Error while searching channel: "+ error));
    });
    req.end();
}

const getYoutubeChannelCustomURL = function(idChannel, callback) {
    var getData = querystring.stringify({ 
        'id': idChannel,
        'part':'snippet',
        'key': client_secret.google_key
    });
    var url = "https://www.googleapis.com/youtube/v3/channels?"+getData;
    var req = https.request(url, (res) => {
        var body = "";
        res.on("data", (chunk) => {
            body += chunk;
        }).on("end", () => {
            const obj = JSON.parse(body);
            let channel = obj.items[0];
            const ret = {
                'name': channel.snippet.title,
                'code': channel.snippet.customUrl
            }
            console.log("Custom URL is "+channel.snippet.customUrl);
            callback(ret);
        }).on("error", (error) => console.log("Error while searching channel: "+ error));
    });
    req.end();
}