//html stuff
var controlDiv = document.getElementById("controlDiv");
var canvas = document.getElementById("canvas");
var addButton = document.getElementById("addButton");

var ctx = canvas.getContext("2d");

var playButton = document.getElementById("playButton");
var pauseButton = document.getElementById("pauseButton");

playButton.addEventListener("click", play);
pauseButton.addEventListener("click", pause);

addButton.addEventListener("click", addOscillator);

var defaultMinFreq = 261; //middle c
var defaultMaxFreq = 523; //high c
var defaultVolume = 50;

var AudioContext;
var audioCtx;

//array for oscillators
var oscillators = [];

//flags for whether it has started or is playing
var started = false;
var playing = false;

var highestFreq = -Infinity;
var lowestFreq = Infinity;

//start time is the time it started/unpaused from(ms)
//pause time is the amount of time elapsed before a pause
var startTime, pauseTime;

//simple resize function
function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
window.addEventListener('resize', resize);
resize();

addOscillator();

drawAxes();

/**
 * Handles pausing
 */
function pause() {
    if (playing) {
        playing = false;
        
        pauseTime = Date.now()-startTime+pauseTime;
        
        for (var i=0;i<oscillators.length;i++) {
            oscillators[i].pause();
        }
    }
}

/**
 * Initiates some stuff that can only be initiated after a button is pressed
 */
function init() {
    AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    
    for (var i=0;i<oscillators.length;i++) {
        oscillators[i].setAudioVariables();
    }
    started = true;
}

/**
 * Actually plays the thing
 */
function play() {
    
    if (started == false) {
        init();
        pauseTime = 0;
    }
    
    if (!playing) {
        playing = true;
        startTime = Date.now();
        
        for (var i=0;i<oscillators.length;i++) {
            oscillators[i].start();
        }
        
        update();
    }
}

/**
 * Updates every frame
 */
function update() {
    if (playing) {
        clearCanvas();
        setFreqs();
        drawAxes();
    
        requestAnimationFrame(update);
    }
}

/**
 * Sets the frequencies
 */
function setFreqs() {
    for (var i=0;i<oscillators.length;i++) {
        oscillators[i].setFreq();
    }
}

/**
 * Draws the graph
 */
function drawAxes() {
    
    var TOP = 50;
    var BOTTOM = 50;
    var LEFT = 75;
    var RIGHT = 50;
    
    var EXTRA = 25;
    var FREQ_OFFSET = 5;
    var TIME_OFFSET = 13;
    
    var width = canvas.offsetWidth;
    var height = canvas.offsetHeight;
    
    ctx.strokeStyle = "#000000";
    
    //base two lines
    ctx.beginPath();
    ctx.moveTo(LEFT, TOP-EXTRA);
    ctx.lineTo(LEFT, height-BOTTOM);
    ctx.lineTo(width-RIGHT, height-BOTTOM);
    ctx.stroke();
    
    //draw axes descriptions
    
    ctx.font = "15px Verdana";
    var text = "Time(s)";
    var textWidth = ctx.measureText(text).width;
    ctx.fillText(text, width/2 - textWidth, height-BOTTOM/2 + TIME_OFFSET);
    
    //have to rotate this one so translate to position then rotate and draw at (0, 0)
    text = "Frequency(Hz)";
    textWidth = ctx.measureText(text).width;
    ctx.save();
    ctx.translate(LEFT/2 - FREQ_OFFSET, height/2+textWidth/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText(text, 0, 0);
    ctx.restore();
    
    //use highest and lowest frequency for y-axis
    var highest = Math.ceil(highestFreq/100) * 100;
    var lowest = Math.floor(lowestFreq/100) * 100;
    
    var step = 100; //make auto adjust later?
    
    var graphWidth = width - LEFT - RIGHT;
    var graphHeight = height - TOP - BOTTOM;
    
    var freqSpan = highest - lowest;
    
    ctx.font = "15px Verdana";
    var numSteps = freqSpan/step;
    for (var i=lowest;i<=highest;i+=step) {
        var textWidth = ctx.measureText(i).width;
        var index = (i-lowest)/step;
        var yPos = height - BOTTOM - index/numSteps * graphHeight;
        ctx.fillText(i, LEFT - textWidth - FREQ_OFFSET, yPos);
    }
    
    //for seconds, step is always seconds
    //x-axis now
    var timeInterval = 1000;
    var timeLength = 4000;
    
    var currTime = 0;
    if (startTime) {
        currTime = Date.now()-startTime+pauseTime;
    }
    var start = currTime - timeLength;
    var end = currTime + timeLength;
    
    var yPos = height-BOTTOM+TIME_OFFSET;
    numSteps = end-start;
    for (var i=Math.ceil(start/1000);i<=Math.floor(end/1000);i++) {
        var xPos = (i*1000-start)/(2*timeLength)*graphWidth + LEFT;
        ctx.fillText(i, xPos, yPos);
    }
    
    var scale = graphHeight/freqSpan;
    for (var i=0;i<oscillators.length;i++) {
        ctx.strokeStyle = oscillators[i].colour;
        
        for (var j=0;j<oscillators[i].pastFreqs.length;j++) {
            var time = oscillators[i].pastFreqs[j][1];
            if (time >= start) {
                var freq = oscillators[i].pastFreqs[j][0];
                var yPos = height - BOTTOM - (freq - lowest) * scale;
                var xPos = (time - start)/(2*timeLength)*graphWidth + LEFT;
                ctx.beginPath();
                ctx.rect(xPos, yPos, 1, 1);
                ctx.stroke();
            }
        }
    }
}

/**
 * Clears the canvas
 */
function clearCanvas() {
    ctx.beginPath();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Constructor for an oscillator object
 */
function Oscillator(colour, volume, minFreq, maxFreq, wave) {
    this.colour = colour;
    this.volume = volume;
    this.minFreq = minFreq;
    this.maxFreq = maxFreq;
    this.wave = wave;
    
    //array of past freqs
    //each element is [freq, timestamp]
    this.pastFreqs = [];
    
    this.paused = false;
    this.timeGap;
    
    oscillators.push(this);
    
    calculateHighLowFreqs();
    
    this.setVolScale();
    
    if (started) {
        this.setAudioVariables();
    }
    
    if (playing) {
        this.setVariables();
        this.oscillator.start();
    }
}

//Oscillator prototype methods
//noise variables
Oscillator.prototype.setVariables = function() {
    this.x = 0;
    this.amp = this.maxFreq-this.minFreq;
    this.wl = 2000; //wavelength in milliseconds
    this.a = Math.random();
    this.b = Math.random();
    this.lastTime = Date.now();
};

Oscillator.prototype.setAudioVariables = function() {
    this.oscillator = audioCtx.createOscillator();
    this.oscillator.type = this.wave;
    this.gainNode = audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(this.volume/this.volScale, audioCtx.currentTime);
    this.oscillator.connect(this.gainNode).connect(audioCtx.destination);
};

Oscillator.prototype.setVolScale = function() {
    //tries to normalise the different wave types volumes somewhat
    //so people don't get their ears hurt :)
    
    switch(this.wave) {
        case "sine":
            this.volScale = 50;
            break;
        case "square":
            this.volScale = 800;
            break;
        case "sawtooth":
            this.volScale = 400;
            break;
        case "triangle":
            this.volScale = 50;
            break;
        default:
            this.volScale = 50;
    }
}

Oscillator.prototype.changeVolume = function(newVolume) {
    this.volume = newVolume;
    if (started) {
        this.gainNode.gain.setValueAtTime(this.volume/this.volScale, audioCtx.currentTime);
    }
}

Oscillator.prototype.changeWave = function(newWave) {
    this.wave = newWave;
    this.setVolScale();
    if (started) {
        this.oscillator.type = this.wave;
    }
    
    this.changeVolume(this.volume);
}

Oscillator.prototype.setFreq = function() {
    var freq;
    if (Date.now() - this.lastTime >= this.wl) {
        this.a = this.b;
        this.b = Math.random();
        freq = this.a * this.amp + this.minFreq;
        this.lastTime = Date.now();
    } else {
        freq = interpolate(this.a, this.b, ((Date.now() - this.lastTime) % this.wl) / this.wl) * this.amp + this.minFreq;
    }
    this.oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    this.pastFreqs.push([freq, Date.now()-startTime+pauseTime]);
    return freq;
}

Oscillator.prototype.pause = function() {
    this.paused = true;
    this.timeGap = Date.now() - this.lastTime;
    this.gainNode.disconnect(audioCtx.destination);
}

Oscillator.prototype.start = function() {
    if (this.paused) {
        this.paused = false;
        this.lastTime = Date.now() - this.timeGap;
        this.gainNode.connect(audioCtx.destination);
    } else {
        this.oscillator.start();
        this.setVariables();
    }
}

/**
 * Sets up an oscillator html element and object 
 */
function addOscillator() {
    
    var volMin = 0;
    var volMax = 100;
    
    //add to html
    var oscillatorOuterEle = document.createElement("DIV");
    oscillatorOuterEle.className = "oscillator-outer";
    
    controlDiv.appendChild(oscillatorOuterEle);
    
    var addButtonEle = document.getElementById("addButton-outer");
    
    controlDiv.insertBefore(oscillatorOuterEle, addButtonEle);
    
    var oscillatorEle = document.createElement("DIV");
    oscillatorEle.className = "oscillator";
    oscillatorEle.index = oscillators.length;
    
    oscillatorOuterEle.appendChild(oscillatorEle);
    
    var oscillatorTopDiv = document.createElement("DIV");
    oscillatorTopDiv.className = "oscillator-top";
    oscillatorTopDiv.innerHTML = "Oscillator"
    
    oscillatorEle.appendChild(oscillatorTopDiv);
    
    var oscillatorDeleteButton = document.createElement("INPUT");
    oscillatorDeleteButton.value = "X";
    oscillatorDeleteButton.className = "oscillator-delete-button";
    oscillatorDeleteButton.type = "button";
    
    oscillatorDeleteButton.addEventListener("click", deleteOscillator);
    
    oscillatorTopDiv.appendChild(oscillatorDeleteButton);
    
    //volume div
    
    var oscillatorVolumeDiv = document.createElement("DIV");
    oscillatorVolumeDiv.className = "oscillator-volume-div";
    
    oscillatorEle.appendChild(oscillatorVolumeDiv);
    
    var oscillatorMinText = document.createElement("SPAN");
    oscillatorMinText.className = "oscillatorText";
    oscillatorMinText.innerHTML = "Volume: " + volMin;
    oscillatorVolumeDiv.appendChild(oscillatorMinText);
    
    var oscillatorVolumeSlider = document.createElement("INPUT");
    oscillatorVolumeSlider.type = "range";
    oscillatorVolumeSlider.value = defaultVolume;
    oscillatorVolumeSlider.min = volMin;
    oscillatorVolumeSlider.max = volMax;
    
    oscillatorVolumeSlider.addEventListener("input", function(e) {
        var index = e.target.parentElement.parentElement.index;
        
        oscillators[index].changeVolume(e.target.value);
    });
    
    oscillatorVolumeDiv.appendChild(oscillatorVolumeSlider);
    
    var oscillatorMaxText = document.createElement("SPAN");
    oscillatorMaxText.className = "oscillatorText";
    oscillatorMaxText.innerHTML = volMax;
    oscillatorVolumeDiv.appendChild(oscillatorMaxText);
    
    var oscillatorFreqDiv = document.createElement("DIV");
    oscillatorEle.appendChild(oscillatorFreqDiv);
    
    var oscillatorFreqMinText = document.createElement("SPAN");
    oscillatorFreqMinText.className = "oscillatorText";
    oscillatorFreqMinText.innerHTML = "Min Freq: ";
    oscillatorFreqDiv.appendChild(oscillatorFreqMinText);
    
    var oscillatorMinFreq = document.createElement("INPUT");
    oscillatorMinFreq.type = "text";
    oscillatorMinFreq.value = defaultMinFreq;
    oscillatorMinFreq.className = "oscillator-input";
    oscillatorFreqDiv.appendChild(oscillatorMinFreq);
    
    oscillatorMinFreq.addEventListener("change", function(e) {
        var index = e.target.parentElement.parentElement.index;
        
        oscillators[index].minFreq = parseInt(e.target.value);
        oscillators[index].amp = oscillators[index].maxFreq-oscillators[index].minFreq;
        calculateHighLowFreqs();
    });
    
    var oscillatorFreqMaxText = document.createElement("SPAN");
    oscillatorFreqMaxText.className = "oscillatorText";
    oscillatorFreqMaxText.innerHTML = " Max Freq: ";
    oscillatorFreqDiv.appendChild(oscillatorFreqMaxText);
    
    var oscillatorMaxFreq = document.createElement("INPUT");
    oscillatorMaxFreq.type = "text";
    oscillatorMaxFreq.value = defaultMaxFreq;
    oscillatorMaxFreq.className = "oscillator-input";
    oscillatorFreqDiv.appendChild(oscillatorMaxFreq);
    
    oscillatorMaxFreq.addEventListener("change", function(e) {
        var index = e.target.parentElement.parentElement.index;
        
        oscillators[index].maxFreq = parseInt(e.target.value);
        oscillators[index].amp = oscillators[index].maxFreq-oscillators[index].minFreq;
        calculateHighLowFreqs();
    });
    
    var oscillatorOtherDiv = document.createElement("DIV");
    oscillatorEle.appendChild(oscillatorOtherDiv);
    
    var oscillatorColourText = document.createElement("SPAN");
    oscillatorColourText.className = "oscillatorText";
    oscillatorColourText.innerHTML = "Colour: ";
    oscillatorOtherDiv.appendChild(oscillatorColourText);
    
    var oscillColour = getRandomColour();
    
    var oscillatorColourInput = document.createElement("INPUT");
    oscillatorColourInput.type = "color";
    oscillatorColourInput.value = oscillColour;
    oscillatorOtherDiv.appendChild(oscillatorColourInput);
    
    oscillatorColourInput.addEventListener("change", function(e) {
        var index = e.target.parentElement.parentElement.index;
    
        oscillators[index].colour = e.target.value;
    });
    
    var oscillatorWaveText = document.createElement("SPAN");
    oscillatorWaveText.className = "oscillatorText";
    oscillatorWaveText.innerHTML = " Wave: ";
    oscillatorOtherDiv.appendChild(oscillatorWaveText);
    
    var oscillatorWaveDropdown = document.createElement("SELECT");
    var sineOption = document.createElement("OPTION");
    sineOption.value = sineOption.innerHTML = "sine";
    sineOption.seelcted = true;
    oscillatorWaveDropdown.appendChild(sineOption);
    
    oscillatorWaveDropdown.addEventListener("change", function(e) {
        var index = e.target.parentElement.parentElement.index;
        
        oscillators[index].changeWave(e.target.value);
    });
    
    var squareOption = document.createElement("OPTION");
    squareOption.value = squareOption.innerHTML = "square";
    oscillatorWaveDropdown.appendChild(squareOption);
    
    var sawtoothOption = document.createElement("OPTION");
    sawtoothOption.value = sawtoothOption.innerHTML = "sawtooth";
    oscillatorWaveDropdown.appendChild(sawtoothOption);
    
    var triangleOption = document.createElement("OPTION");
    triangleOption.value = triangleOption.innerHTML = "triangle";
    oscillatorWaveDropdown.appendChild(triangleOption);
    
    oscillatorOtherDiv.appendChild(oscillatorWaveDropdown);
    
    new Oscillator(oscillColour, defaultVolume, defaultMinFreq, defaultMaxFreq, "sine");
}

/**
 * Deletes an oscillator
 * first gets index from element then calculates new indices
 */
function deleteOscillator(e) {
    var index = e.target.parentElement.parentElement.index;
    
    for (var i=0;i<controlDiv.children.length;i++) {
        var outerEle = controlDiv.children[i];
        if (outerEle.className === "oscillator-outer") {
            var ele = outerEle.children[0];
            
            if (ele.index == index) {
                controlDiv.removeChild(outerEle);
                i--;
            } else if (ele.index > index) {
                ele.index--;
            }
        }
    }
    
    if (playing) {
        oscillators[index].oscillator.stop();
    }
    oscillators.splice(index, 1);
}

/**
 * Calculates the highest and lowest possible frequency for the graph
 */
function calculateHighLowFreqs() {
    highestFreq = -Infinity;
    lowestFreq = Infinity;
    for (var i=0;i<oscillators.length;i++) {
        if (oscillators[i].minFreq < lowestFreq) {
            lowestFreq = oscillators[i].minFreq;
        }
        if (oscillators[i].maxFreq > highestFreq) {
            highestFreq = oscillators[i].maxFreq;
        }
    }
}

/**
 * returns a hex string representing a colour
 */
function getRandomColour() {
    var colour = "#";
    for (var i=0;i<6;i++) {
        colour += getRandomInt(0, 15).toString(16);
    }
    return colour;
}

/**
 * returns an integer between min and max(inclusive)
 * from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns an interpolation between two values
 * x should be a value between 0 and 1
 */
function interpolate(a, b, x) {
    var ft = x * Math.PI;
    var f = (1 - Math.cos(ft)) * 0.5;
    return a * (1 - f) + b * f;
}