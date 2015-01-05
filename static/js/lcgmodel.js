var RenderedCard = fabric.util.createClass(fabric.Group, {
	type: 'rendered-card',
	initialize: function(objects,options){
		this.callSuper('initalize',objects,options);
		options&& this.set('card_data',options.card);
		//is the card visisble? add appropriate image background
		var bgimg;
		if(this.card_data.visibleSelf)
		{
			bgimg=fabric.Image.fromURL('static/img/cards/1.5 Cards FULL-'+((1e15+this.card_data.card[0]+"").slice(-3))+'.png',
				function(img)
				{
					img.hasControls=false;

					if(this.card_data.card[1]=="Plot")
						img.rotate(90);
					img.scale(0.5);
					if(!this.card_data.visibleWorld)
						img.setOpacity(0.5);
					img.on('object:dblclick',function(options)
					{
						if(img.getAngle() == 0)
						{
							img.rotate(60);
							canvas.renderAll();
						}	
						else if(img.getAngle()!=90)
						{
								img.rotate(0);
								canvas.renderAll();
						}

					});
					img.on('mouse:down',function(options)
					{
						if(options.e.button==2)
						{
							console.log('right click yo');
							//TODO: Add context menu
							options.e.preventDefault();
							return false;
						}
						return true;
					});
					
				});
		}
		else
		{
			bgimg=fabric.Image.fromURL('static/img/game-of-thrones_card-back.jpg',
				function(img)
				{
					img.hasControls=false;

					if(this.card_data.card[1]=="Plot")
						img.rotate(90);
					img.scale(0.5);
					if(!this.card_data.visibleWorld)
						img.setOpacity(0.5);
					img.on('object:dblclick',function(options)
					{
						

					});
					img.on('mouse:down',function(options)
					{
						if(options.e.button==2)
						{
							console.log('right click yo');
							//TODO: Add context menu
							options.e.preventDefault();
							return false;
						}
						return true;
					});
					
				});
		}
		this.addWithUpdate(object);
		//are there any tokens?

	},
	toObject: function(){
		return fabric.util.object.extend(this.callSuper('toObject'), {card_data:this.card_data});
	}
});

RenderedCard.fromObject = function (object, callback) {
    var _enlivenedObjects;
    fabric.util.enlivenObjects(object.objects, function (enlivenedObjects) {
        delete object.objects;
        _enlivenedObjects = enlivenedObjects;
    });
    return new fabric.RenderedCard(_enlivenedObjects, object);
};