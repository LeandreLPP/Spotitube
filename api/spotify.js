const https = require('https');
const querystring = require('querystring');
require('dotenv').config();

var exports = module.exports = {};

// SPOTIFY WRAPPER API
exports.getSpotifyToken = function(callback) {
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

exports.identifySong = function(id, callback, callbackError) {
    exports.getSpotifyToken((token) => {
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

exports.identifyArtist = function(id, callback, callbackError) {
    exports.getSpotifyToken((token) => {
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

exports.identifyAlbum = function(id, callback, callbackError) {
    exports.getSpotifyToken((token) => {
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