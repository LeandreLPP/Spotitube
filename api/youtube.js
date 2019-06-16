const https = require('https');
const querystring = require('querystring');
require('dotenv').config();

var exports = module.exports = {};

// Margin to compensate for the lack of search accuracy when searching for a full album
const ALBUM_MAX_RESULTS_MARGIN = 10;

// YOUTUBE WRAPPER API
exports.searchVideo = function(song, callback, callbackError) {
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

exports.searchChannel = function(artistName, callback, callbackError) {
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

exports.searchAlbum = function(album, callback, callbackError) {
    var searchTerms = `"Provided to YouTube" ${album.artists.join(" ")} ${album.name}`;
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

                exports.bulkSearchVideos(missingSongs).then(result => {
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

exports.bulkSearchVideos = function(songs) {
    return new Promise((bulkResolve, bulkReject) => {
        if(!Array.isArray(songs)) {
            bulkReject("[bulkSearchYoutubeVideos] argument 'songs' must be an array");
        } else {
            let promises = [];
            
            if(songs.length > 0) {
                console.log(`Using bulk search to find songs '${songs.map(song => song.name).join("', '")}'`);

                for (let song of songs) {
                    promises.push(new Promise(function(resolve, reject) {
                        setTimeout(reject, 10 * 1000); // Reject after 10 seconds without a response
                        exports.searchVideo(song, (video) => {
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

exports.generateAnonymousPlaylist = function(videoCodes, title, callback) {
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