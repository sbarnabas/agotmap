from flask import Flask,render_template
import logging

app = Flask(__name__)
app.config['DEBUG'] = True

# Note: We don't need to call run() since our application is embedded within
# the App Engine WSGI application server.


@app.route('/')
def hello():
    """Return an index page."""
    try:
    	return render_template('index.html')
    except Exception as ex:
    	 logging.error(str(ex))
    	 return "error"



@app.errorhandler(404)
def page_not_found(e):
    """Return a custom 404 error."""
    return 'Sorry, nothing at this URL.', 404