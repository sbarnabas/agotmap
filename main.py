import jinja2
import os
import webapp2
import json
from google.appengine.api import channel
from google.appengine.api import users
from google.appengine.api import memcache
from google.appengine.ext import ndb
import datetime
import time
import logging
import csv

class User(ndb.Model):
	displayName = ndb.StringProperty()
	userID = ndb.StringProperty()
	channelID = ndb.StringProperty()


class Message(ndb.Model):
	author = ndb.StringProperty()
	content = ndb.StringProperty(indexed=False)
	timestamp = ndb.DateTimeProperty(auto_now_add=True)

class Room(ndb.Model):
	name = ndb.StringProperty()
	users = ndb.StructuredProperty(User,repeated=True)
	messages = ndb.StructuredProperty(Message,repeated=True)

class Card(ndb.Model):
	faction = ndb.StringProperty()
	title = ndb.StringProperty()
	cardtype = ndb.StringProperty()
	icons =ndb.StringProperty()
	cost = ndb.StringProperty()
	loyal  = ndb.StringProperty()
	pclaim  = ndb.StringProperty()
	pgold  = ndb.StringProperty()
	pinit  = ndb.StringProperty()
	pres  = ndb.StringProperty()
	cardstr = ndb.StringProperty() 
	cardtxt = ndb.StringProperty()
	traits = ndb.StringProperty()
	ver  = ndb.StringProperty()


class CardLocation(ndb.Model):
	xval = ndb.FloatProperty()
	yval = ndb.FloatProperty()
	zindex = ndb.IntegerProperty()

class CardToken(ndb.Model):
	tokentype = ndb.StringProperty()
	count = ndb.IntegerProperty()


class Pile(ndb.Model):
	name = ndb.StringProperty()
	cards = ndb.LocalStructuredProperty(Card,repeated=True)
	ownervisible = ndb.BooleanProperty()
	worldvisible = ndb.BooleanProperty()
	stacked = ndb.BooleanProperty()


class Player(ndb.Model):
	user = ndb.LocalStructuredProperty(User)
	piles = ndb.LocalStructuredProperty(Pile,repeated=True)
	gold = ndb.IntegerProperty()

class PlayedCard(ndb.Model):
	card = ndb.StructuredProperty(Card)
	owner = ndb.StructuredProperty(Player)
	location = ndb.StructuredProperty(CardLocation)
	ownervisible = ndb.BooleanProperty()
	worldvisible = ndb.BooleanProperty()	
	tokens = ndb.LocalStructuredProperty(CardToken,repeated=True)

class GameState(ndb.Model):
	canvas = ndb.TextProperty()
	playedcards = ndb.LocalStructuredProperty(PlayedCard, repeated=True)


class GameAction(ndb.Model):
	action = ndb.StringProperty()
	timestamp = ndb.DateTimeProperty(auto_now_add=True)

class Game(ndb.Model):
	name = ndb.StringProperty()
	gametype = ndb.StringProperty()
	public = ndb.BooleanProperty()
	players = ndb.LocalStructuredProperty(Player,repeated=True)
	spectators = ndb.LocalStructuredProperty(User,repeated=True)
	chatroom  = ndb.StructuredProperty(Room)
	gamestate = ndb.StructuredProperty(GameState)
	actions = ndb.LocalStructuredProperty(GameAction,repeated=True)


# Note: We don't need to call run() since our application is embedded within
# the App Engine WSGI application server.




class MainPage(webapp2.RequestHandler):
  """This page is responsible for showing the game UI. It may also
  create a new game or add the currently-logged in user to a game."""

  def get(self):

    template = jinja_environment.get_template('index.html')
    self.response.out.write(template.render())


class GetToken(webapp2.RequestHandler):
	def get(self):
		user=self.request.get('u')
		ip=self.request.remote_addr
		if user:
			#check for existing channels for the user and re-reigster them
			token = channel.create_channel(str(user)+'0')
			obj = {'success': 'true', 'token':token}

		else:
			obj= {'success':'false'}
		self.response.headers['Content-Type'] = 'application/json'
		return self.response.out.write(json.dumps(obj))

class SendMsg(webapp2.RequestHandler):
	def post(self):
	
		obj = json.loads(self.request.body)
		if(obj["msgType"] == "chat"):
			#do chat fanout
			room = Room.get_by_id(obj["destination"])
			jmsg = { 
				'msgType':'chat',
				'destination':obj["destination"],
				'user':obj["userdisplayname"],
				'msg': obj["content"],
				'timestamp': int(time.mktime(datetime.datetime.utcnow().timetuple())) * 1000
				}
			for puser in room.users:
				channel.send_message(puser.userID+puser.channelID+'0',json.dumps(jmsg))
			#add to logs here
			room.messages.append(Message(author=obj["userdisplayname"],content=obj["content"]))
			room.put()
			pass
		elif (obj["msgType"] == "joinRoom"):
			#create and/or join room
			#get list of rooms
			room=Room.get_by_id(obj["destination"])
			if(room and obj["userid"]):
				#room exists
				#get existing users
				presentUsers = list(room.users)
				#add the current user to the room
				room.users.append(User(
					displayName = obj["userdisplayname"],
					userID=obj["userid"],
					channelID=obj["channelguid"]
					))
				rpop = len(room.users)
				#send a joined message to all the other users
				jmsg = { 
				'msgType':'joinedRoom',
				'destination':obj["destination"],
				'username':obj["userdisplayname"],
				'population': str(rpop)
				}
				for puser in presentUsers:
					channel.send_message(puser.userID+puser.channelID+'0',json.dumps(jmsg))
				
				#send last 5 messages in the room to the new user
				todisplay =5
				if len(room.messages) < 5:
					todisplay=len(room.messages)

				for msg in room.messages[(0-todisplay):]:
					jmsg = { 
					'msgType':'chat',
					'destination':room.name,
					'user':msg.author,
					'msg': msg.content,
					'timestamp':  int(time.mktime(msg.timestamp.timetuple())) * 1000
					}
					channel.send_message(obj["userid"]+obj["channelguid"]+'0',json.dumps(jmsg))

				#send a successful join response to the original user
				jmsg2 = {
				'msgType':'joinRoom',
				'destination':obj["destination"],
				'username':obj["userdisplayname"],
				'population': str(rpop)
				}
				channel.send_message(obj["userid"]+obj["channelguid"]+'0',json.dumps(jmsg2))
				obj["population"] = rpop
				room.put()
			else:
				#room doesn't exist - let's create it with one member
				room = Room(id=obj["destination"],
					name=obj["destination"],
					users=[User(
					displayName = obj["userdisplayname"],
					userID = obj["userid"],
					channelID=obj["channelguid"]
					)],
					messages=[])
				rpop = len(room.users)
				jmsg2 = {
				'msgType':'joinRoom',
				'destination':obj["destination"],
				'username':obj["userdisplayname"],
				'population': str(rpop)
				}
				channel.send_message(obj["userid"]+obj["channelguid"]+'0',json.dumps(jmsg2))
				obj["population"] =str(rpop)
				room.put()
			pass
		elif (obj("msgType") == "leaveRoom"):
			#leave room
			pass




		return self.response.out.write(json.dumps(obj))


class Disconnecter(webapp2.RequestHandler):
	def post(self):
		client_id = self.request.get('from')
		
		query = Room.query().fetch()
		for room in query:
			remove=False
			userToRemove=None
			for user in room.users:
				logging.info(repr(user))
				if(user.channelID):
					if( user.userID+user.channelID+'0' == client_id):
						remove =True
						userToRemove=user
			if(remove):
				room.users.remove(userToRemove)
				#send leftroom message
				rpop = len(room.users)
				#send a left message to all the other users
				jmsg = { 
				'msgType':'leftRoom',
				'destination':room.name,
				'username':userToRemove.displayName,
				'population': str(rpop)
				}
				for puser in room.users:
					channel.send_message(puser.userID+puser.channelID+'0',json.dumps(jmsg))

				room.put()



class Purge(webapp2.RequestHandler):
	def get(self):
		query = Room.query().fetch()
		for room in query:
			room.key.delete()




class GetCards(webapp2.RequestHandler):
	cards=[]

	def __init__(self,request,response):
		self.initialize(request,response)
		with open('static/data/agot2ecards-new.tab','rU') as f:
			reader = csv.reader(f,delimiter='\t')
			for faction,title,cardtype,icons,cost,loyal,pclaim,pgold,pinit,pres,cardstr,cardtxt,traits,ver in reader:
				self.cards.append (Card(
					faction = faction,
					title = title,
					cardtype = cardtype,
					icons = icons,
					cost = cost,
					loyal  = loyal,
					pclaim  = pclaim,
					pgold  = pgold,
					pinit  = pinit,
					pres  = pres,
					cardstr = cardstr,
					cardtxt = cardtxt,
					traits = traits,
					ver  = ver
					))
	def get(self):
		return self.response.out.write(json.dumps([p.to_dict() for p in self.cards]))

class CreateGame(webapp2.RequestHandler):
	
	def post(self):
		obj = json.loads(self.request.body)
		u = User(
					displayName = obj["userdisplayname"],
					userID = obj["userid"],
					channelID=obj["channelguid"]
					)
		g = Game(
				id = obj["gameid"],
				name=obj["gamename"],
				gametype=obj["gametype"],
				public = obj["public"],
				players=[Player(
						user=u,
						piles=[],
						gold=0
						)],
				spectators =[],
				chatroom = Room(id=obj["chatroom"],
					name=obj["chatroom"],
					users=[u],
					messages=[]),
				gamestate=None,
				actions = [GameAction(
					action="Game "+obj["gamename"]+"("+obj["gametype"]+") created by "+ obj["userdisplayname"])
				]
			)

		g.put()
		#send message to room associated with the game
				#send a successful join response to the original user
		jmsg2 = {
		'msgType':'joinRoom',
		'destination':obj["chatroom"],
		'username':obj["userdisplayname"],
		'population': "1"
		}
		channel.send_message(obj["userid"]+obj["channelguid"]+'0',json.dumps(jmsg2))
		pass


jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)+'/templates'))
app = webapp2.WSGIApplication([('/', MainPage),
							   ('/gettoken',GetToken),
							   ('/sendmsg',SendMsg),
							   ('/purge',Purge),
							   ('/_ah/channel/disconnected/', Disconnecter),
							   ('/getcards',GetCards)
							   ],
                              debug=True)