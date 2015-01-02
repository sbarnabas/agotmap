var lcgdemo = angular.module('lcgdemo',[]);

lcgdemo.controller('HomeCtrl', function ($scope,$http)
{
	$scope.initCanvas=[];
	$scope.currentgames=[];
	$scope.gamestates=[];
	$scope.user="";
	$scope.loggedin=false;
	$scope.connected=false;
	$scope.myguid='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
		});
	$scope.checkLogin = function()
	{
		 var sessionParams = {
   				'client_id': '572158139651-tshk579c1s4riuvcj7k8h1eg89dvh49q.apps.googleusercontent.com',
   				'session_state': null
  			};
		gapi.client.load('plus','v1').then(function () 
		{
			gapi.auth.checkSessionState(sessionParams,function(stateMatched)
			{
				if(stateMatched)
				{
					//not logged in
					$scope.loggedin=false;
					$scope.user="";
					$scope.game="";
		
				}
				else
		
				{						

						gapi.auth.authorize(
								{'client_id':'572158139651-tshk579c1s4riuvcj7k8h1eg89dvh49q.apps.googleusercontent.com',
								'immediate':'true',
								'cookie_policy':'single_host_origin',
								'cookiepolicy':'single_host_origin',
								'scope':'profile https://www.googleapis.com/auth/plus.profile.emails.read'},
								function(token)
								{
									if(!token.error)
									{
										var request= gapi.client.plus.people.get({'userId':'me'});
										request.execute(function(resp) {
											$scope.finishLogin(resp);

										});
									}
									else
									{

									}

								}

							)

				}

			});
		});
		
	}

	$scope.finishLogin = function(resp)
	{
		
		$scope.$apply( function() {
			$scope.userid=resp.id;
			$scope.loggedin=true;

			$scope.user=resp.displayName;
			$scope.email=resp.emails['account'];
			$scope.game='A Game of Thrones';
			$scope.active="lobby";
		});

	}

	$scope.$watch('loggedin',function()
	{

		
		//do actual connection here
		if($scope.loggedin && !$scope.connected) 
		{
			
			var rpromise = $http.get("/gettoken?u="+$scope.userid+$scope.myguid);
			rpromise.success(function(data,status,headers,config)
			{
				//get token
				$scope.channelToken = data.token;

				$scope.channel = new goog.appengine.Channel($scope.channelToken);
				$scope.socket = $scope.channel.open();
				$scope.socket.onopen = function (){
					
					
					//attempt to join the room
					//loading animation?
					setTimeout(function(){
						var jmsgsend={
							'msgType':'joinRoom',
							'destination':'Game of Thrones Lobby',
							'userdisplayname':$scope.user,
							'userid': $scope.userid,
							'channelguid': $scope.myguid
						};
						
					var joinpromise = $http.post('/sendmsg', jmsgsend
						)
					.success(function(data,status,headers,config)
					{
						$scope.connected=true;
						
					});
				}, 1500);
					
				};


				$scope.socket.onmessage = function(m) { 

				
					var data=JSON.parse(m.data);
					//console.dir(data);
					if(data.msgType == 'joinRoom')
					{

						var roomname=data.destination;
						if(data.destination in $scope.currentgames)
							roomname=$scope.currentgames[data.destination];

						$("[data-room-name='"+data.destination+"']").append(
						$('<tr>')
						.addClass('success')
						.addClass('sysmsg')
							.append($('<td>').attr('colspan','100%')
								.text("Connected to Room: "+roomname+" at "+new Date().toLocaleTimeString()))
						);

						$("[data-room-name='"+data.destination+"']").append(
						$('<tr>')
						.addClass('info')
						.addClass('sysmsg')
							.append($('<td>').attr('colspan','100%')
								.text(data.population+((data.population!=1)?" people here. ":" person here.")))
						);
					}
					else if(data.msgType == 'joinedRoom')
					{

						$("[data-room-name='"+data.destination+"']").append(
						$('<tr>')
						.addClass('info')
						.addClass('sysmsg')
							.append($('<td>').attr('colspan','100%')
								.text(data.username+" joined. "+data.population+ ((data.population!=1)?" people here. ":" person here.")))
						);
					}
					else if(data.msgType== 'leftRoom')
					{
						$("[data-room-name='"+data.destination+"']").append(
						$('<tr>')
						.addClass('info')
						.addClass('sysmsg')
							.append($('<td>').attr('colspan','100%')
								.text(data.username+" left. "+data.population+ ((data.population!=1)?" people here. ":" person here.")))
						);
					}
					else if(data.msgType=='chat')
					{
						var d=new Date(0);
						d.setUTCMilliseconds(data.timestamp);
						$("[data-room-name='"+data.destination+"'] tr:last").after(
							$('<tr>').append(
								$('<td>')
									.append($('<b>').text(data.user+":"))
									
								.addClass("msgname"))
								.attr("data-toggle","tooltip")
								.attr("data-placement","left")
								.attr("title",d.toLocaleString()).tooltip()
							.append(
								$('<td>').text(data.msg).addClass("msgbody")
								)
							);
						var txt=$("[data-room-name='"+data.destination+"'] tr:last td:last").html();
						if(txt) {
						$("[data-room-name='"+data.destination+"'] tr:last td:last").html(txt.autoLink({ target: "_blank"}));
					}
						$("[data-room-name='"+data.destination+"']")
							.scrollTop($("[data-room-name='"+data.destination+"']")[0].scrollHeight);
						
						if($scope.active!='lobby')
							{
							
								$scope.msgcount+=1;
								$scope.$apply();
							}
					}

				};

				$scope.socket.onerror = function(err) {
					//do something here
					console.log("socket error");
					console.dir(err);

				};

				$scope.socket.onclose = function() {
					//send disconnect message
					console.log("socket closed");

				};


				if($scope.loggedin && !$scope.connected)
				{
					//request key from app
					$scope.msgcount=0;
					
				}

			});

		}
          
	});

	$scope.notImplemented= function()
	{
		swal("Sorry...", "This feature isn't in the demo!", "error");
	};
	$scope.noLogin = function()
	{
		swal("Sorry...","Please use Google login","error");
	}
	$scope.logout=function()
	{
		gapi.auth.signOut();
		$scope.loggedin=false;
		$scope.user="";
		$scope.game="";

	}
	$scope.login= function()
	{

		var additionalParams= { 'callback': $scope.signedin,
								'cookiepolicy':'single_host_origin',
								'cookie_policy':'single_host_origin'};
		gapi.auth.signIn(additionalParams);

	}
	$scope.signedin=function(authResult)
	{

		
		if(authResult['status']['signed_in'])
		{
			gapi.client.load('plus','v1').then(function () {

				
				var request= gapi.client.plus.people.get({'userId':'me'});
				request.execute(function(resp) {

					$scope.finishLogin(resp);
					
				});
			});
		}
		else
		{
			if(authResult['error']!='user_signed_out')
				//swal("Error!","Invalid Sign-in state: "+authResult['error']);
			{
				
				console.log("error from auth result:");
				console.dir(authResult);
			}
		}
	}
	
	$scope.sendMessage = function()
	{



		var msg=$('#mesg').val();
		if(msg.trim().length > 0)
		{
		
			var jmsgsend={
							'msgType':'chat',
							'destination':'Game of Thrones Lobby',
							'userdisplayname':$scope.user,
							'userid': $scope.userid,
							'channelguid': $scope.myguid,
							'content' : msg
						};
						//console.dir(jmsgsend);
					var joinpromise = $http.post('/sendmsg', jmsgsend
						)
					.success(function(data,status,headers,config)
					{

					});


		
			$('#mesg').val("");
			$('#chat').scrollTop($('#chat')[0].scrollHeight);
			
		}
	}

	$scope.viewLobby = function()
	{
		$scope.active='lobby';
		$scope.msgcount=0;
	}
	$scope.viewCards = function()
	{
		$scope.active='cards';
		var dataset=[];
		$("canvas").each(function(i)
		{
			if(!$scope.initCanvas[$(this).attr("id")])
			{
				$scope.fabricInit($(this).attr("id"));

				if($(this).attr("id")=="deckbuilder-canvas")
				{
					$.getJSON('getcards',function(data)
					{
						$.each(data,function(f,g){
							dataset.push(
							[
								g["index"],
								g["cardtype"],
								g["faction"],
								g["title"],
								g["traits"],
								g["cardtxt"],
								g["icons"],
								g["cost"],
								g["cardstr"],
								g["loyal"]?'Yes':'No',
								g["pclaim"],
								g["pgold"],
								g["pinit"],
								g["pres"]
							]

							);
						})

					}).then(function() {

						var cardtable=$("#cardlist").DataTable(
							{
								data:dataset,
								"dom": 'C<"clear">Rlfrtip',
								"columnDefs": [
						            {
						                "targets": [ 0 ],
						                "visible": false,
						                "searchable": false
						            },
						           
						        ]

							});
						 $("#cardlist tbody").on('click','tr',function()
						 {
						 	$('#cardlist tbody tr').removeClass('selected');
						 	$(this).toggleClass('selected');
						 });
					});
				}

			}
		});

		
	}

	$scope.newGame = function()
	{

		
		


		var gamename=$('#gamename').val()
		var gameid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
		});
		var gametype="Game of Thrones (Joust)"
		var gamepublic = $('#gamepublic').is(':checked');
		var chatroom = gameid //game id is the room id, should make things a little easier
		$("#tabnav li").removeClass("active");
		//create new tab with title = game name
		$("#tabnav").append(
			$("<li>")
				.append(
					$("<a>")
					.attr("href","#"+gameid)
					.attr("data-toggle","tab")
					.text(gamename)

					)
				.addClass("active")
				);

		$("#tabholder div").removeClass("active");

		$("#tabholder").append(
				$("<div>").text("CREATED A NEW GAME OMG: "+gamename)
				.attr("id",gameid)
				.addClass("active")
				.addClass("tab-pane")

			)

		$scope.currentgames[gameid]=gamename; //map id to name for display reasons

		//call create game with data
		var jmsgsend={
							'userdisplayname':$scope.user,
							'userid': $scope.userid,
							'channelguid': $scope.myguid,
							'gameid':gameid,
							'gamename':gamename,
							'gametype':gametype,
							'chatroom':chatroom,
							'public':gamepublic
							
						};
		//send action to init player, 

	}
	$scope.resetNewGameForm =function()
	{
		$('#gamename').val("");
		$('#gamepublic').attr('checked',false);
	}

	$scope.loadCards=function()
	{

		//draw a card
			//rectangle
			//text
			//placeholder for image
		var canvas=$scope.initCanvas["deckbuilder-canvas"];
		
		fabric.Image.fromURL('static/img/game-of-thrones_card-back.jpg',
			function(img)
			{
				img.hasControls=false;
				canvas.add(img);
			});

		var border = new fabric.Rect({
			  lockRotation: true,
			  lockScalingX: true,
			  lockScalingY:true,
			  hasBorders:false,
			  hasControls:false,
			  left: 0,
			  top: 0,
			  fill: 'white',
			  width: 300,
			  height: 421,
			  strokeWidth:5,
			  stroke: 'rgba(0,0,0,1)'
			});
		
		var fborder = new fabric.Rect({
			  lockRotation: true,
			  lockScalingX: true,
			  lockScalingY:true,
			  hasBorders:false,
			  hasControls:false,
			  left: 5,
			  top: 5,
			  fill: 'white',
			  width: 275,
			  height: 396,
			  strokeWidth:20,
			  stroke: 'rgba(229,207,56,1)'
			});


		var cost = new fabric.Group([new fabric.Circle({
			radius:25,
			fill:'white',
			stroke:'rgba(0,0,0,1)' ,
			strokeWidth: 5,
			originX:'center',
			originY: 'center',

		}),new fabric.Text ('6',{
			fontSize: 30,
			originX:'center',
			originY: 'center',
		})],
		{
			hasControls:false,
			top:15,
			left:15,
		});

		var group = new fabric.Group([border,fborder,cost], {
			hasControls:false,
			left:150,
			top:100,
		});
		canvas.add(group);

	}
	$scope.getCanvasCard=function(card,x,y)
	{
		
	
	}

	$scope.fabricInit = function fabricInit(id)
	{
		var canvas = new fabric.Canvas(id);
		
		$(canvas.getElement().parentNode).on('mousewheel', function(e) {
			var newZoom = canvas.getZoom() + (e.originalEvent.deltaY / 300)/100;
      		canvas.zoomToPoint({ x: e.offsetX, y: e.offsetY }, newZoom);
			return false;
		});

		$scope.initCanvas[id]=canvas;
		canvas.setBackgroundColor("rgba(240,240,240,0.5)",canvas.renderAll.bind(canvas));
	}

});

