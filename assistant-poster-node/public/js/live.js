// ========================================================
// Global variables
// ========================================================

var MEDIUM = 200;
SHAPE_SIZE = MEDIUM;
var STROKE_WIDTH = 8;

var currentShape = "circle";
var currentColor = palette.blue;
var currentBorder = currentShape;
var currentIndex = 0;
var currentStyle = "random-primitive";
var currentExtra = "none";

var primitive;

var ws;

var canvas, modifierCloud;
var modifierImages = [];

var queryText;

$(document).ready(function() {
	console.log("document ready");

	initWebsocket();
	initWebcam();

	canvas = document.getElementById("paper-canvas");
	paper.setup(canvas);

	modifierCloud = document.getElementById("modifier-cloud");

	// original paths that won't be inserted into the DOM
	originals = new paper.Group({ insert: false });
	// result paths that will be inserted into the DOM
	results = new paper.Group({ insert: true });

	initSVGs();
});

// ========================================================
// Websocket function
// ========================================================

const initWebsocket = () => {
	ws = new WebSocket("ws://127.0.0.1:8081");

	ws.onopen = () => {
		console.log("Websocket open");
		ws.send(JSON.stringify({
	    'cmd': 'id',
	    'extra': 'live'
	  }));
	};

	ws.onmessage = event => {

		console.log(`Websocket message = ${event.data}`);

		let cmd = event.data.split(':');

		if (event.data == "clear") {
			clearPoster();
		} else if (cmd[0] === 'transcript') {
			updateQuery(cmd[1]);
		} else {
			const cmd = JSON.parse(event.data);

			// add the image of the canvas to the cloud div, if it isn't blank
			if (!isCanvasBlank()) convertCanvasToCloudImage();
			
			currentShape = cmd[0];
			currentColor = cmd[1];
			currentIndex = cmd[2];
			currentBorder = cmd[3];
			currentStyle = cmd[4];
			currentExtra = cmd[5];

      clear();

			return;
		}
	};
};

const updateQuery = (query) => {

	let cq = $("#current-query");

	if (query.startsWith('dry')) {
		query = query.replace('dry', 'draw');
	} else if (query.startsWith('drop')) {
		query = query.replace('drop', 'draw');
	} else if (query.startsWith('drug')) {
		query = query.replace('drug', 'draw');
	}

	cq.textillate({
		in: { effect: 'fadeIn', delay: 25 },
    out: {
    	effect: 'fadeOut',
    	delay: 25,
    	callback: () => {
				cq.find('.texts li:first').text(`"Hey Google, ${query}"`)
  			cq.textillate('in')
    	}
    }
  });

  cq.textillate('out')
};

// ========================================================
// Main canvas handler
// ========================================================

function nextShape() {
	primitive = new Primitive(
		currentShape,
		SHAPE_SIZE,
		currentColor,
		paper.view.center,
		currentIndex,
		0,
		currentBorder,
		currentStyle,
		currentExtra
	);

  $(canvas).animateCss("fadeIn");
}

function clear() {
	if (primitive != null) {
    $(canvas).animateCss("fadeOut", function () {
      primitive.clear();
      nextShape();     
    });
	} else {
    nextShape();
  }
}

function clearPoster() {
  modifierImages.forEach(img => {
    $(img).animateCss("rollOut", () => {
      modifierCloud.removeChild(img);
    })
  });
  modifierImages = [];

  if (primitive != null) {
    $(canvas).animateCss("rollOut", function () {
      primitive.clear();     
    });
  }
}

// ========================================================
// Text animator
// ========================================================

// $(function() {
//   $('.current-query').textillate({
//     in: { effect: 'fadeIn' },
//     out: { effect: 'fadeOut' }
//   });
// });

// var blockLetters = new TimelineMax({ paused: false });
// var text = $("current-query");

// var wordTiming = 0.2;

// function revertSplit(targetSplit, newString) {

//   if (newString !== undefined) {
//     albumLetters.pause(0).clear();
//     targetSplit.revert();

//     TweenLite.set(fullText, {
//       autoAlpha: 0,
//       text: { value: newString }
//     });

//     splitHeadline = new SplitText(
//       fullText, {
//       type: "words,chars"
//     });

//     chars = splitHeadline.chars;

//     TweenLite.set(fullText, { autoAlpha: 1});

//     albumLetters
//       .staggerFrom()
//   }
// }

// ========================================================
// Webcam
// ========================================================

const initWebcam = () => {
	navigator.getUserMedia =
		navigator.getUserMedia ||
		navigator.webkitGetUserMedia ||
		navigator.mozGetUserMedia ||
		navigator.msGetUserMedia ||
		navigator.oGetUserMedia;
	const handleVideo = stream => {
		var video = document.getElementById("video-element");
		video.srcObject = stream;
	};
	const videoError = e => {
		console.log(`Video error = ${JSON.stringify(e)}`);
	};

	if (navigator.getUserMedia) {
		navigator.getUserMedia({ video: true }, handleVideo, videoError);
	}
};

// ========================================================
// Queue animator
// ========================================================

/** converts the global canvas to an img object, and adds it to the DOM */
function convertCanvasToCloudImage() {
	// create new img DOM element
	var newImg = document.createElement("img");
	newImg.setAttribute("src", canvas.toDataURL());
	newImg.classList.add("modifier-shape");

	modifierCloud.appendChild(newImg);
	modifierImages.push(newImg);
	$(newImg).animateCss("fadeInLeft")

	// determine how wide each image is
	var imgHeight = parseInt(window.getComputedStyle(newImg).getPropertyValue("height"));
	var canvasHeight = parseInt(window.getComputedStyle(canvas).getPropertyValue("height"));
	var canvasWidth = parseInt(window.getComputedStyle(canvas).getPropertyValue("width"));
	var imgWidth = canvasWidth * imgHeight / canvasHeight;

	// determine how wide the cloud div is
	var cloudWidth = parseInt(
		window.getComputedStyle(modifierCloud).getPropertyValue("width")
	);

	// remove images from the DOM if there are too many to fit in the cloud div
	if (modifierImages.length * imgWidth > cloudWidth) {
		var lastImg = modifierImages.shift();

		$(lastImg).animateCss("rollOut", function () {
			modifierCloud.removeChild(lastImg);			
		})

		modifierImages.forEach(img => {
			$(img).animateCss("slideOutRight")
		});
	}
}

$.fn.extend({
	animateCss: function(animationName, callback) {
	  var animationEnd = (function(el) {
		var animations = {
		  animation: 'animationend',
		  OAnimation: 'oAnimationEnd',
		  MozAnimation: 'mozAnimationEnd',
		  WebkitAnimation: 'webkitAnimationEnd',
		};
  
		for (var t in animations) {
		  if (el.style[t] !== undefined) {
			return animations[t];
		  }
		}
	  })(document.createElement('div'));
  
	  this.addClass('animated ' + animationName).one(animationEnd, function() {
		$(this).removeClass('animated ' + animationName);
  
		if (typeof callback === 'function') callback();
	  });
  
	  return this;
	},
  });

/** determines if the global canvas is blank */
function isCanvasBlank() {
	var blank = document.createElement("canvas");
	blank.width = canvas.width;
	blank.height = canvas.height;

	return canvas.toDataURL() == blank.toDataURL();
}
