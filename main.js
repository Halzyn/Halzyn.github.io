// Spotify Web Data Connector - 9.8.16 - Madeleine Corneli (updated slightly by It's Ya Boi Halzyn)

var myConnector = tableau.makeConnector();

var CLIENT_ID = "e046ca6eaa5340968a6eb9c0a2a6e454";
var REDIRECT_URI = "https://halzyn.github.io/";
var url = "https://accounts.spotify.com/authorize/?client_id=" + 
CLIENT_ID + 
"&response_type=token&redirect_uri=" + REDIRECT_URI + 
"&scope=user-read-private%20playlist-read-private%20user-library-read";

var user_id = "";
var accessToken = "";
var tableData = [];
var playlistData = [];
var songData = []
var featureData = [];

// AJAX call: user accessToken to return user_id
function get_user_info(token,accessCallback) {
	$.ajax({
		url: 'https://api.spotify.com/v1/me',
		headers: {
			'Authorization': 'Bearer ' + token
		},
		success: accessCallback
	})
};

// AJAX call: sends list of user playlists to playlistCallback
function get_playlists(playlistCallback){
	var plurl = 'https://api.spotify.com/v1/users/' + user_id + '/playlists';
	$.ajax({
		url: plurl,
		headers: {
			'Authorization' : 'Bearer ' + accessToken
		},
		success:  playlistCallback
	})
}

// callback: adds playlist names and ids to playlistData (only if the user created them)
function playlistCallback(data){
	for (i=0; i<data["items"].length; i++){
		var playlist_name = data["items"][i]["name"];
		var playlist_id = data["items"][i]["id"];
		var oid = data["items"][i]["owner"]["id"];
		if (oid == user_id ){
			playlistData.push({"playlist": playlist_name, "id" : playlist_id});
		}
	};
	// stor playlist data, user_id and accessToken in tableau's connection data object
	tableau.connectionData = JSON.stringify([playlistData, user_id, accessToken])
	tableau.connectionName = "Spotify Playlist Connector";
	// this kicks off the getData() stage
	tableau.submit();
}

// callback: once user_id is retrieved, kick off playlist retrieval 
function accessCallback(response){
	user_id = response["id"];
	get_playlists(playlistCallback);
}

// tableau.submit() starts this function flow
(function () {	
	// define the schema of the table(s)
	myConnector.getSchema = function (schemaCallback) {
		var spotify_cols = [
			{ id: "song", alias: "Song Name", dataType : tableau.dataTypeEnum.string },
			{ id: "artist", alias: "Artist", dataType : tableau.dataTypeEnum.string },
			{ id: "date_added", alias: "Date Added", dataType : tableau.dataTypeEnum.datetime},
			{ id: "playlist", alias: "Playlist Name", dataType : tableau.dataTypeEnum.string },
			{ id: "valence", alias: "Valence", dataType : tableau.dataTypeEnum.float},
			{ id: "danceability", alias: "Danceability", dataType : tableau.dataTypeEnum.float},
			{ id: "energy", alias: "Energy", dataType : tableau.dataTypeEnum.float},
			{ id: "mode", alias: "Mode", dataType : tableau.dataTypeEnum.int},
			{ id: "isrc", alias: "isrc", dataType : tableau.dataTypeEnum.string},

		];
		
		var spotify_tableInfo = {
			id : "spotify",
			alias : "Spotify Song Data",
			columns : spotify_cols
		};

		var test_cols = [
			{ id: "test", alias: "Test", dataType : tableau.dataTypeEnum.string}
		];

		var test_tableInfo = {
			id: "TEST",
			alias: "test table",
			columns: test_cols
		}

		schemaCallback([spotify_tableInfo, test_tableInfo]);
	};
	
	// retrieve the table data - this function loops through playlistData
	// 		(stored in connectionData) and makes ajax calls to retrieve song data
	myConnector.getData = function(table, doneCallback) {

		var cd = JSON.parse(tableau.connectionData);
		var async_request = [];
		var songs = [];
		var features = [];
		var user_id = cd[1];
		var accessToken = cd[2];
		var playlistData = cd[0];
		// loop through playlistData and create an AJAX call object for each to retrieve songs
		for(i in playlistData){
			var id = playlistData[i]['id'];
			var name = playlistData[i]['playlist']
			var surl = 'https://api.spotify.com/v1/users/' + user_id + '/playlists/' + id + '/tracks';
			async_request.push(
				$.ajax({
					url: surl,
					headers: {
						'Authorization' : 'Bearer ' + accessToken
					},
					success: function(data){
							songs.push(data);
					}
				})
			);
			
		};
		// loop through all songs and create an AJAX call object for each to retrieve features
		for(i in songs){
			var id = songs[i]['items']["track"]["id"];
			var furl = 'https://api.spotify.com/v1/audio-features/21451j1KhjAiaYKflxBjr1';
			async_request.push(
				$.ajax({
					url: furl,
					headers: {
						'Authorization' : 'Bearer ' + accessToken
					},
					success: function(data){
							features.push(data);
					}
				})
			);
		};
		// once the AJAX creation is complete, send them all over - LOOPED AJAX WOO
		$.when.apply(null, async_request).done( function(){
			var playlist_name; 
			var valence, danceability, energy, mode;
			for (i in songs){
				var song_names = songs[i]["items"]
				var playlist_id = songs[i]["href"].match(/([^/]*\/){8}/)[1].slice(0, -1)
				for (j in song_names){
					var song_title = song_names[j]["track"]["name"]
					var artist = song_names[j]["track"]["artists"][0]["name"]
					var date_added = song_names[j]["added_at"]
					var song_id = song_names[j]["track"]["id"]
					var isrc = song_names[j]["track"]["external_ids"]["isrc"]
					// get the playlist name (super inefficient)
					for (k in playlistData){
						if (playlist_id == playlistData[k]["id"]){
							playlist_name = playlistData[k]["playlist"]
							tableau.log(playlist_name)
						}
					}
					// add the song data to tableData
					tableData.push({"playlist" : playlist_name, "song" : song_title, "date_added": date_added, "artist" : artist, "isrc" : isrc})
				}
				for (m in features){
					valence = features[m]["valence"]
					danceability = features[m]["danceability"]
					energy = features[m]["energy"]
					mode = features[m]["mode"]
					tableData.push({"valence" : valence, "danceability" : danceability, "energy": energy, "mode" : mode})
				}
			}
			table.appendRows(tableData);
			doneCallback();
		});
	};
	
	tableau.registerConnector(myConnector);

})();

//submit button starts the workflow
$(document).ready(function () {
	$("#submitButton").click(function () {
		var path = window.location.href;
		if (path.indexOf("access_token") == -1) {
			var w = document.location.assign(url);
		}
		else {
			path = window.location.href;
			accessToken = path.split("access_token=")[1].split("&token_type")[0];
			get_user_info(accessToken, accessCallback);
		}
	});
});	
