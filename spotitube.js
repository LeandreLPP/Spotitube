const Client = require("discord.js").Client;
const https = require('https');
const querystring = require('querystring');
require('dotenv').config();

// Margin to compensate for the lack of search accuracy when searching for a full album
const ALBUM_MAX_RESULTS_MARGIN = 10;

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
            }, getCallbackError(message.channel, "J'ai pô trouvé de vidéo qui corresponde... Désolé."))
        }, getCallbackError(message.channel, "Donnez moi un un lien valide, bondiou !"));
    } else if(res = message.content.match(regexArtist)) {
        // extract the id of the artist
        var id = res[1];
        console.log("Link for an ARTIST on spotify detected. ID="+id);
        identifyArtist(id, (artistName) => {
            console.log("Artist of id " + id + " identified as " + artistName);
            searchYoutubeChannel(artistName, (channel) => {
                console.log("Youtube channel found: \"" + channel.name + "\" at youtube code "+ channel.code);
                message.channel.send("https://www.youtube.com/channel/" + channel.code);
            }, getCallbackError(message.channel, "La recherche de chaine correspondante a échoué. Toutes mes excuses."));
        }, getCallbackError(message.channel, "Ha ha ha, il a cru que son lien fonctionnait !"));
    } else if(res = message.content.match(regexAlbum)) {
        // extract the id of the album
        var id = res[1];

        console.log("Link for a spotify ALBUM detected. ID="+id);
        identifyAlbum(id, (album) => 
        {
            console.log(`Album of id ${id} identified as ${album.name} by ${album.artists.join(", ")} (${album.totalTracks} tracks)`);
            searchYoutubeAlbum(album, (result) => {
                generateAnonymousYoutubePlaylist(result.videoCodes, `${album.name} · ${album.artists.join(", ")}`, function(youtubeUrl) {
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

const identifySong = function(id, callback, callbackError) {
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
                if(obj.error) {
                    callbackError(obj.error);
                } else {
                    var song = {
                        name : obj.name,
                        authors : []
                    }
                    obj.artists.forEach(element => {
                        song.authors.push(element.name);
                    });
                    callback(song);
                }
            }).on("error", callbackError);
        });
        req.end();
    });
}

const identifyArtist = function(id, callback, callbackError) {
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
                if(obj.error) {
                    callbackError(obj.error);
                } else {
                    var name = obj.name;
                    callback(name);
                }
            }).on("error", callbackError);
        });
        req.end();
    });
}

const identifyAlbum = function(id, callback, callbackError) {
    getSpotifyToken((token) => {
        const options = {
            hostname: 'api.spotify.com',
            path: '/v1/albums/'+id,
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
                if(obj.error) {
                    callbackError(obj.error);
                } else {

                    let album = {
                        name: obj.name,
                        totalTracks: obj.total_tracks,
                        artists: obj.artists.map(artist => artist.name),
                        songs: obj.tracks.items.map(item => ({ name: item.name, authors: item.artists.map(artist => artist.name) }))
                    };

                    callback(album);
                }
            }).on("error", callbackError);
        });
        req.end();
    });
}

const getSpotifyToken = function(callback) {
    const credential = process.env.SPOTIFY_ID + ":" + process.env.SPOTIFY_SECRET;
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

const searchYoutubeVideo = function(song, callback, callbackError) {
    var searchTerms = song.name;
    song.authors.forEach(element => searchTerms += " "+element);
    var getData = querystring.stringify({ 
        'type': 'video',
        'q': searchTerms,
        'maxResults': 1,
        'part':'snippet',
        'key': process.env.GOOGLE_KEY
    });
    var url = "https://www.googleapis.com/youtube/v3/search?"+getData;
    var req = https.request(url, (res) => {
        var body = "";
        res.on("data", (chunk) => {
            body += chunk;
        }).on("end", () => {
            const obj = JSON.parse(body);
            if(obj.error) {
                callbackError(obj.error);
            } else if(obj.items.length > 0) {
                const item = obj.items[0];
                var video = {
                    name: item.snippet.title,
                    code: item.id.videoId
                }
                callback(video);
            } else {
                callbackError("No video found for query \""+searchTerms+"\".");
            }
        }).on("error", callbackError);
    });
    req.end();
}

const searchYoutubeChannel = function(artistName, callback, callbackError) {
    var getData = querystring.stringify({ 
        'type': 'channel',
        'q': artistName,
        'maxResults': 1,
        'part':'snippet',
        'key': process.env.GOOGLE_KEY
    });
    var url = "https://www.googleapis.com/youtube/v3/search?"+getData;
    var req = https.request(url, (res) => {
        var body = "";
        res.on("data", (chunk) => {
            body += chunk;
        }).on("end", () => {
            const obj = JSON.parse(body);
            if(obj.error) {
                callbackError(obj.error);
            } else if(obj.items.length > 0) {
                const ret = {
                    'name': obj.items[0].snippet.title,
                    'code': obj.items[0].id.channelId
                }
                console.log("Youtube channel is ID "+ret.code);
                callback(ret);
            } else {
                callbackError("No video found for name \""+artistName+"\".");
            }
        }).on("error", callbackError);
    });
    req.end();
}

const searchYoutubeAlbum = function(album, callback, callbackError) {
    var searchTerms = `${album.artists.join(" ")} ${album.name}`;
    var getData = querystring.stringify({ 
        'type': 'video',
        'q': searchTerms,
        'maxResults': Math.min(50, album.totalTracks + ALBUM_MAX_RESULTS_MARGIN),
        'part':'snippet',
        'key': process.env.GOOGLE_KEY
    });
    var url = "https://www.googleapis.com/youtube/v3/search?"+getData;

    var req = https.request(url, (res) => {
        var body = "";
        res.on("data", (chunk) => {
            body += chunk;
        }).on("end", () => {
            const obj = JSON.parse(body);
            if(obj.error) {
                callbackError(obj.error);
            } else if(obj.items.length > 0) {
                
                let codeForTitle = {}
                for(song of album.songs) {
                    codeForTitle[song.name] = "";
                }
                
                for(item of obj.items) {
                    // Youtube API response is HTML encoded
                     let videoTitle = item.snippet.title.replace(/&#39;/g, "'"); 

                    if(codeForTitle[videoTitle] === "") {
                        codeForTitle[videoTitle] = item.id.videoId;
                    }
                }
                
                let missingSongs = album.songs.filter(song => codeForTitle[song.name] === "");

                console.log(`Found ${album.totalTracks - missingSongs.length}/${album.totalTracks} songs during initial album search`)

                bulkSearchYoutubeVideos(missingSongs).then(result => {
                    for(video of result.videos) {
                        codeForTitle[video.title] = video.code;
                    }

                    let videoCodes = album.songs.filter(song => codeForTitle[song.name] !== "").map(song => codeForTitle[song.name]);
                    callback({videoCodes: videoCodes, notFoundCount: result.notFoundCount});
                }).catch(error => {
                    callbackError(error);
                });
            } else {
                callbackError(`No video found for album query "${searchTerms}".`);
            }
        }).on("error", callbackError);
    });
    req.end();
}

const bulkSearchYoutubeVideos = function(songs) {
    return new Promise((bulkResolve, bulkReject) => {
        if(!Array.isArray(songs)) {
            bulkReject("[bulkSearchYoutubeVideos] argument 'songs' must be an array");
        } else {
            let promises = [];
            
            if(songs.length > 0) {
                console.log(`Using bulk search to find songs '${songs.map(song => name).join("', '")}'`);

                for (let song of songs) {
                    promises.push(new Promise(function(resolve, reject) {
                        setTimeout(reject, 10 * 1000); // Reject after 10 seconds without a response
                        searchYoutubeVideo(song, (video) => {
                            console.log(`Found: "${video.name}" at youtube code ${video.code}`);
                            resolve({title: song.name, code:video.code});
                        }, reject );
                    }));
                }
            }
    
            Promise.all(promises.map(p => p.catch(() => undefined))).then((results) => {
    
                let result = {
                    videos: results.filter(x => x !== undefined),
                    notFoundCount: results.filter(x => x === undefined).length
                };
    
                bulkResolve(result);
            });
        }
    });
}

const generateAnonymousYoutubePlaylist = function(videoCodes, title, callback) {

    var getData = querystring.stringify({ 
        'video_ids': videoCodes.join(),
        'title': title,
    });

    const options = {
        hostname: 'www.youtube.com',
        path: '/watch_videos?' + getData,
        method: 'GET'
    };

    var req = https.request(options, (res) => {
        console.log("Generated anonymous playlist : " + res.headers.location);
        callback(res.headers.location);
    });
    req.end();
}