/*
Copyright (c) 2013 William Malone (www.williammalone.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*global window, document, navigator */

var BLOCKS;

if (BLOCKS === undefined) {
	BLOCKS = {};
}

BLOCKS.game = function (spec, element) {
	
	"use strict";
	
	var game = BLOCKS.eventDispatcher(),
		clock = BLOCKS.clock(),
		gameContainer,
		interactionContainer,
		paused = false,
		virtualKeyboard,
		motors = [],
		tickers = [],
		debugPressTimeout,
		lastUpdateTime,
		remainingUpdate,
		minHeight,
		scaleLandscape,
		scalePortrait,
		debugLayer,
		gameTappedOnce,
		loaded,
		tickerIndex = 0,
		
		handleTickers = function () {
			
			var i, 
				tickerArr = [], 
				callbacks = [];
			
			for (i = 0; i < tickers.length; i += 1) {
				tickers[i].curTick += 1;
				if (tickers[i].curTick >= tickers[i].totalTicks) {
					callbacks.push(tickers[i]);
				} else {
					tickerArr.push(tickers[i]);
				}
			}
			tickers = tickerArr;
			
			for (i = 0; i < callbacks.length; i += 1) {
				callbacks[i].callback(callbacks[i].parameters);
			}
		},

		onOrientationChange = function () {
		
			// Remove the space on iPhone / iPod when in landscape and using minimal ui meta tag
			if ((navigator.userAgent.match(/iPhone/i)) || (navigator.userAgent.match(/iPod/i))) {
				if (window.orientation === 90 || window.orientation === -90) {
					window.scrollTo(0, 0);
					resizeGame();
				}
			}
		},
		
		onVisibilityChange = function () {
		
			if (document.hidden || document.webkitHidden || document.mozHidden || document.msHidden) {
				game.pause();
			} else {
				game.unpause();
			}
		},
		
		onFirstTap = function () {
			
			if (!gameTappedOnce) {
				game.controller.removeEventListener("tap", onFirstTap);
				
				gameTappedOnce = true;
				
				if (game.introScreen) {
					game.introScreen.destroy();
					game.introScreen = null;
				}
				game.state = "loading";
				game.speaker.load();
				checkLoadProgress();
			}
		},
		
		init = function () {
		
			var i;
		
			gameContainer = document.createElement("article");
			gameContainer.id = "BlocksGameContainer";
			if (spec && spec.minHeight) {
				minHeight = spec.minHeight;
				gameContainer.style.minHeight = minHeight + "px";
			}
			if (spec && spec.scaleLandscape !== undefined) {
				scaleLandscape = spec.scaleLandscape;
			} else {
				scaleLandscape = true;
			}
			if (spec && spec.scalePortrait !== undefined) {
				scalePortrait = spec.scalePortrait;
			} else {
				scalePortrait = true;
			}
			game.element.appendChild(gameContainer);
			
			interactionContainer = document.createElement("article");
			interactionContainer.id = "BlocksInteractionContainer";
			gameContainer.appendChild(interactionContainer);
			
			game.controller = BLOCKS.controller(interactionContainer);
			
			for (i = 0; i < 10; i += 1) {
				game.addLayer("blocksGameLayer" + (i + 1));
			}
			
			if (game.debug) {

				virtualKeyboard = BLOCKS.virtualKeyboard(game.controller, {
					layer: game.addLayer("internalblocksjsdebuglayer", {
						zIndex: 999999
					}, false),
					customKeys: spec.customVirtualKeys
				});
			}
	
			window.addEventListener("orientationchange", onOrientationChange);
			window.addEventListener("resize", resizeGame);
			
			resizeGame();
			
			game.controller.addEventListener("keyUp", onKeyUp);
			game.controller.addEventListener("keyDown", onKeyDown);
			
			game.controller.addEventListener("tap", onTap);
			game.controller.addEventListener("drag", onDrag);
			game.controller.addEventListener("release", onRelease);
			game.controller.addEventListener("cancel", onRelease); // Note cancel is retreated as a release
			
			game.controller.addEventListener("touchStart", onTouchStart);
			game.controller.addEventListener("touchMove", onTouchMove);
			game.controller.addEventListener("touchEnd", onTouchEnd);
			game.controller.addEventListener("touchCancel", onTouchEnd); // Note cancel is retreated as a touch end
			
			game.controller.addEventListener("mouseDown", onMouseDown);
			game.controller.addEventListener("mouseMove", onMouseMove);
			game.controller.addEventListener("mouseUp", onMouseUp);
			game.controller.addEventListener("mouseCancel", onMouseUp); // Note cancel is retreated as a mouse up
			
			game.controller.addEventListener("tap", onFirstTap);
			
			// Mute and pause the game when the browser is not visible
			if (typeof document.hidden !== "undefined") {	
				document.addEventListener("visibilitychange", onVisibilityChange);
			} else if (typeof document.mozHidden !== "undefined") {
				document.addEventListener("mozvisibilitychange", onVisibilityChange);
			} else if (typeof document.msHidden !== "undefined") {
				document.addEventListener("msvisibilitychange", onVisibilityChange);
			} else if (typeof document.webkitHidden !== "undefined") {
				document.addEventListener("webkitvisibilitychange", onVisibilityChange);
			}
			
			window.onunload = game.destroy;
		},
		
		gameUpdate = function () {
			
			var now;
			
			if (!paused) {

				now = + new Date();
				remainingUpdate += (now - lastUpdateTime);
				lastUpdateTime = now;	
				
				// If too much update then crop it
				if (remainingUpdate > game.maxLoopDuration) {
				
					BLOCKS.warn("Cannot keep up with game loop. Chopping " + Math.ceil((remainingUpdate - game.maxLoopDuration) / 60) + " frames.");
					remainingUpdate = game.maxLoopDuration;
				}
				
				//if (remainingUpdate < 16.666666666666) {
				//	BLOCKS.debug("No update this time: " + remainingUpdate);
				//}
	
				while (remainingUpdate >= 16.666666666666) {
				
					remainingUpdate -= 16.666666666666;
					
					game.dispatchEvent("tick"); // Simulate a clock
				
					game.dispatchEvent("preUpdate");
				
					if (game.debug) {
						virtualKeyboard.update();
					}
					
					handleTickers();
	
					game.update();
					
					game.dispatchEvent("postUpdate");
				}
			}
			
		},
		
		gameRender = function () {
			
			var e = {
				camera: game.camera
			};
		
			if (!paused) {

				game.dispatchEvent("preRender", e);
			
				if (game.debug) {
					virtualKeyboard.render(e);
				}
				
				game.render(e);
				
				game.dispatchEvent("postRender", e);
			}
		},
		
		onClockTick = function () {
			
			gameUpdate();
			gameRender();
		},
		
		onKeyDown = function (e) {
			
			if (game.keyDown) {
				game.keyDown(e);
			}
		},
		
		onKeyUp = function (e) {
			
			if (game.keyUp) {
				game.keyUp(e);
			}
		},
		
		onTap = function (pos) {

			if (game.debug) {
				if (pos.x < 100 && pos.y < 100) {
					debugPressTimeout = window.setTimeout(function () {
						virtualKeyboard.visible = !virtualKeyboard.visible;
						virtualKeyboard.dirty = true;
					}, 1000);
				}
				virtualKeyboard.onTap(pos);
			}
		
			if (game.tap) {
				game.tap(pos);
			}
		},
		
		onDrag = function (pos) {
		
			if (game.debug) {
				window.clearTimeout(debugPressTimeout);
			}
			
			if (game.drag) {
				game.drag(pos);
			}
		},
		
		onRelease = function (pos) {
			
			if (game.debug) {
				window.clearTimeout(debugPressTimeout);
			}
			
			if (game.release) {
				game.release(pos);
			}
		},
		
		onTouchStart = function (pos) {
				
			if (game.touchStart) {
				game.touchStart(pos);
			}
		},
		
		onTouchMove = function (pos) {
		
			if (game.touchMove) {
				game.touchMove(pos);
			}
		},
		
		onTouchEnd = function (pos) {
		
			if (game.touchEnd) {
				game.touchEnd(pos);
			}
		},
		
		onMouseDown = function (pos) {
				
			if (game.mouseDown) {
				game.mouseDown(pos);
			}
		},
		
		onMouseMove = function (pos) {
		
			if (game.mouseMove) {
				game.mouseMove(pos);
			}
		},
		
		onMouseUp = function (pos) {
		
			if (game.mouseUp) {
				game.mouseUp(pos);
			}
		},
		
		checkLoadProgress = function () {
		
//BLOCKS.debug("checkLoadProgress: " + gameTappedOnce + " " + game.imageLoader.isLoaded() + " " + game.speaker.isReady());
			if (!loaded) {
				if ((game.introScreen && gameTappedOnce) || !game.introScreen) {
					// If all images are loaded and all sounds (or number of sounds is zero) are laoded
					if (game.imageLoader.isLoaded() && (game.speaker.isReady() || game.speaker.getNumFiles() === 0)) {
		
						loaded = true;
						game.start();
						if (game.loadingScreen) {
							game.loadingScreen.destroy();
							game.loadingScreen = null;
						}
						game.dispatchEvent("loaded");
					}
				}
			}
		},
		
		resizeGame = function () {
		
			var i, viewportWidth, viewportHeight, newGameWidth, newGameHeight, newGameX, newGameY, gameContainerWidth, gameContainerHeight, gameAspectRatio, gameSafeAspectRatio, viewportAspectRatio;
			
			// Get the dimensions of the viewport
			viewportWidth = game.element.offsetWidth;
			viewportHeight = game.element.offsetHeight;
			
			// If the viewport is greater than the minumum game height use the miniumum instead
			if (minHeight && viewportHeight < minHeight) {
				viewportHeight = minHeight;
			}
		
			// If the game should not be scaled
			if (!scaleLandscape && Math.abs(window.orientation) === 90 || 
				!scalePortrait && Math.abs(window.orientation) !== 90) {
			
				newGameHeight = game.height;
				newGameWidth = game.width;
				
			} else {
			
				viewportAspectRatio = viewportHeight / viewportWidth;
				gameAspectRatio = game.height / game.width;
				
				if (gameAspectRatio > viewportAspectRatio) {

					// Landscape letterbox on top and bottom
					if (game.safeHeight / game.width > viewportAspectRatio) {
//BLOCKS.debug("1");
						gameContainerHeight = viewportHeight * game.height / game.safeHeight;
						gameContainerWidth = gameContainerHeight / gameAspectRatio;
					// Landscape cropping game on right and left
					} else {
//BLOCKS.debug("2");
						gameContainerWidth = viewportWidth;
						gameContainerHeight = gameContainerWidth * gameAspectRatio;
					}

				} else {
					// Landscape cropping game on right and left
					if (game.height / game.safeWidth > viewportAspectRatio) {
//BLOCKS.debug("3");
						gameContainerHeight = viewportHeight;
						gameContainerWidth = gameContainerHeight / gameAspectRatio;
					// Portrait Letterbox on top and bottom
					} else { 
//BLOCKS.debug("4");
						gameContainerWidth = viewportWidth * game.width / game.safeWidth;
						gameContainerHeight = gameContainerWidth * gameAspectRatio;
					}
				}

				newGameWidth = gameContainerWidth;
				newGameHeight = gameContainerHeight;
			}
			
			// If the game is not wide enough to fill the viewport
			//if (newGameWidth < viewportWidth) {
				newGameX = (viewportWidth - newGameWidth) / 2;
			//} else {
			//	newGameX = 0;
			//}

			// If the game is not tall enough to fill the viewport
			//if (newGameHeight < viewportHeight) {
				newGameY = (viewportHeight - newGameHeight) / 2;
			//} else {
			//	newGameY = 0;
			//}
			
			// Save the game scale amount
			game.scale = newGameWidth / game.width;
			
			if (newGameX < 0) {
				game.camera.x = -newGameX / game.scale;
			} else {
				game.camera.x = 0;
			}
			if (newGameY < 0) {
				game.camera.y = -newGameY / game.scale;
			} else {
				game.camera.y = 0;
			}

			// Set the new padding of the game so it will be centered
            gameContainer.style.padding = Math.max(newGameY, 0) + "px " + Math.max(newGameX, 0) + "px";
			
			// Tell the controller the game dimensions
			game.controller.scaleX = game.width / newGameWidth;
			game.controller.scaleY = game.height / newGameHeight;
			
			game.camera.width = (viewportWidth - Math.max(newGameX, 0) * 2) / game.scale;
			game.camera.height = (viewportHeight - Math.max(newGameY, 0) * 2) / game.scale;
			
//BLOCKS.debug("Resize Game -> camera: " + game.camera.width + " x " + game.camera.height + " (" + game.camera.x + ", " + game.camera.y + ") ");

			for (i = 0; i < game.layers.length; i += 1) {			
				game.layers[i].width = game.camera.width;
				game.layers[i].height = game.camera.height;
			}
			
			game.dispatchEvent("resize");
		};
	
	// Define spec as empty object if it was specified as a parameter
	spec = spec || {};

	game.layers = [];
	game.width = (spec && spec.width !== undefined) ? spec.width : 1024;
	game.height = (spec && spec.height !== undefined) ? spec.height : 768;
	game.safeWidth = (spec && spec.safeWidth);
	game.safeHeight = (spec && spec.safeHeight);
	game.debug = (spec && spec.debug !== undefined) ? spec.debug : false;
	game.maxLoopDuration = (spec && spec.maxLoopDuration !== undefined) ? spec.maxLoopDuration : 500;
	game.scale = 1;
	game.stage = BLOCKS.container(game);
	game.camera = BLOCKS.camera({
		width: game.width,
		height: game.height
	});
	game.state = "intro";
	
	
	game.pause = function () {
	
		if (!paused) {
			//BLOCKS.debug("Game not visible so pause");
			paused = true;
			if (game.speaker) {
				game.speaker.mute();
				game.speaker.pause();
				game.dispatchEvent("pause");
			}
		}
	};
	
	game.resize = function () {
	
		resizeGame();
	};
	
	game.unpause = function () {
	
		if (paused) {
			//BLOCKS.debug("Game is visible again so unpause");
			
			paused = false;
			lastUpdateTime = + new Date();	
			
			if (game.speaker) {
				game.speaker.unmute();
				game.speaker.unpause();
				game.dispatchEvent("unpause");
			}
		}
	};
	
	game.update = function () {
		
		game.stage.update();
	};
	
	game.render = function (e) {

		game.stage.render(e);
	};
	
	game.getLayer = function (name) {
		
		var i;
		
		for (i = 0; i < game.layers.length; i += 1) {
			if (game.layers[i].name === name) {
				return game.layers[i];
			}
		}
	};
	
	game.createLayer = function (name, options) {
	
		options = options || {};
		options.name = name;
		
		options.parentElement = interactionContainer;
		if (!options.width) {
			options.width = game.camera.width;
		}
		if (!options.height) {
			options.height = game.camera.height;
		}

		return BLOCKS.layer(options);
	};
		
	game.destroyLayer = function (layer) {
		
		layer.destroy();
		layer = null;
	};
		
	game.addLayer = function (name, options) {
	
		var layer;
		
		if (!game.getLayer(name)) {
		
			layer = game.createLayer(name, options);

			game.layers.push(layer);
			return layer;
		} else {
			BLOCKS.warn("Cannot add layer '" + name + "' because it already exists.");
		}
	};
	
	game.removeLayer = function (name) {
	
		var i;
		
		for (i = 0; i < game.layers.length; i += 1) {
			if (game.layers[i].name === name) {
				game.destroyLayer(game.layers[i]);
				game.layers.splice(i, 1);
				return true;
			}
		}
	
		BLOCKS.warn("Cannot remove layer '" + name + "' because it cannot be found.");
	};
	
	game.addMotor = function (type) {
	
		var key,
			motor,
			spec = arguments[1];

		if (type === "drag") {
			spec.controller = game.controller;
		} else {
			spec.clock = game;
		}

		if (BLOCKS.motors && BLOCKS.motors[type]) {
	
			motor = BLOCKS.motors[type](spec);
			motor.type = type;
			if (spec.object) {
				spec.object.motorize(motor);
			}
			motor.addEventListener("destroyed", game.removeMotor);
			motors.push(motor);
			
			return motor;
		} else {
			BLOCKS.warn("Cannot add motor of type '" + type + "' because its definition cannot be found.");
		}
	};
	
	game.removeMotor = function (motor) {
	
		var i;
			
		for (i = 0; i < motors.length; i += 1)  {
			if (motors[i] === motor) {
				motors.splice(i, 1);
				break;
			}
		}
	};
	
	game.addTicker = function (callback, duration, parameters) {
	
		var id = (+ new Date()).toString() + tickerIndex;
		
		tickerIndex += 1;
		if (tickerIndex > 99999999) {
			tickerIndex = 0;
		}

		tickers.push({
			id: id,
			curTick: 0,
			totalTicks: Math.ceil(duration * 60 / 1000),
			callback: callback,
			parameters: parameters
		});
		
		return id;
	};
	
	game.removeTicker = function (id) {
		
		var i, existingTickers = [];
		
		for (i = 0; i < tickers.length; i += 1) {
			if (tickers[i].id === id) {
				tickers[i] = null;
			} else {
				existingTickers.push(tickers[i]);
			}
		}
		
		tickers = existingTickers;
	};
	
	game.clearTickers = function () {
	
		tickers = [];
	};
		
	// The element in which the game markup will be injected will be the element with
	//   the "BlockGame" id unless specified via a parameter of the game
	game.element = (element !== undefined) ? element : document.getElementById("BlocksGame");
	
	game.load = function () {
		var i;

		game.imageLoader.loadFromTree(spec);

		// Define game sounds
		if (spec.sounds) {
			for (i = 0; i < spec.sounds.length; i += 1) {
				game.speaker.createSound(spec.sounds[i]);
			}
		}

		game.imageLoader.addEventListener("update", function () {
		
			var assetsLoaded = game.imageLoader.getNumFilesLoaded() + game.speaker.getNumFilesLoaded();

			if (game.loadingScreen) {
				game.loadingScreen.setProgress(assetsLoaded, game.imageLoader.getNumFiles() + game.speaker.getNumFiles());
			}
		});
		
		game.imageLoader.addEventListener("complete", function () {
		
			checkLoadProgress();
		});
		game.imageLoader.load();
	};
	
	game.stop = function () {
		
		clock.removeEventListener("tick", onClockTick);	
		clock.stop();
	};
	
	game.start = function () {
	
		var i;
	
		lastUpdateTime = + new Date();
		remainingUpdate = 0;
		
		//for (i = 0; i < 10; i += 1) {
		//	game.addLayer("blocksGameLayer" + (i + 1));
		//}

		if (game.prepare) {
			game.prepare();
		}
		
		clock.removeEventListener("tick", onClockTick);	
		clock.addEventListener("tick", onClockTick);
		clock.start();
	};
	
	game.destroy = function () {
	
		var i;

		clock.destroy();
		
		if (game.loadingScreen) {
			game.loadingScreen.destroy();
		}
		
		for (i = 0; i < game.layers; i += 1) {
			game.removeLayer(game.layers[i]);
		}
	};
	
	game.isPaused = function () {

		return paused;
	};
	
	game.imageLoader = (spec && spec.imagesPath) ? BLOCKS.preloader(spec.imagesPath) : BLOCKS.preloader();
	if (spec && spec.loading) {
		game.loadingScreen = BLOCKS.loadingScreen(spec.loading, game);
	}
	if (spec && spec.intro) {
		game.introScreen = BLOCKS.introScreen(spec.intro, game);
	}
	
	// Create sound player
	game.speaker = BLOCKS.speaker({
		path: (spec && spec.audioPath !== undefined) ? spec.audioPath : "",
		src: (spec && spec.audioSpriteSrc !== undefined) ? spec.audioSpriteSrc : ""
	});
	game.speaker.addEventListener("update", function (e) {
		
		var assetsLoaded = game.imageLoader.getNumFilesLoaded() + game.speaker.getNumFilesLoaded();

		if (game.loadingScreen) {
			game.loadingScreen.setProgress(assetsLoaded, game.imageLoader.getNumFiles() + game.speaker.getNumFiles());
		}
	});
	game.speaker.addEventListener("ready", function () {
//BLOCKS.debug("Speaker load complete");
		checkLoadProgress();
	}, true);
	
    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/	
	(function() {
		var lastTime = 0;
		var vendors = ['webkit', 'moz'];
		for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
			window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
			window.cancelAnimationFrame =
				window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
		}
	
		if (!window.requestAnimationFrame)
		window.requestAnimationFrame = function(callback, element) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16 - (currTime - lastTime));
			var id = window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};
	
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = function(id) {
				window.clearTimeout(id);
		};
	}());
	
	init();
	
	return game;
};